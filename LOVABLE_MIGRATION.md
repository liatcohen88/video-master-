# Lovable / Supabase Migration Guide

מסמך פעולות מינימלי להפיכת האפליקציה ה-Next.js המקומית למוצר מאוחסן ב-Lovable עם Supabase + Stripe. אינו מבוצע אוטומטית — דורש הרשמה לשירותים.

---

## 1. חשבונות לפתוח

| שירות | למה | עלות |
|---|---|---|
| **Lovable** | hosting (Next.js + edge functions) | חינמי להתחלה, ~$25/חודש בייצור |
| **Supabase** | Postgres + Auth + Storage | חינמי עד 500MB + 50k משתמשים |
| ~~Stripe~~ → **PayPlus** | סליקה ישראלית | 1.9% + ₪1 לעסקה, אפס דמי חודש |
| **Replicate** | Whisper בענן (אם להוריד עומס מהשרת) | ~$0.0003/דקה |
| **Modal.com** | FFmpeg כעבודה אסינכרונית | ~$0.05 לעיבוד |

---

## 2. Supabase Schema

הריצי ב-Supabase SQL Editor:

```sql
-- משתמשים (Supabase Auth כבר מספק auth.users — זו הרחבה)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  credits int not null default 25,
  total_spent_ils int not null default 0,
  status text not null default 'active' check (status in ('active','suspended')),
  is_admin boolean not null default false,
  created_at timestamptz default now(),
  last_active timestamptz default now()
);

-- סרטונים שעובדו
create table public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  file_name text,
  duration_sec int,
  mode text,
  credits_used int,
  status text check (status in ('done','failed','in_progress')),
  output_url text,
  created_at timestamptz default now()
);

-- עסקאות תשלום (חתום בידי webhook של Stripe)
create table public.revenue_txns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  stripe_session_id text unique,
  amount_ils int,
  credits_bought int,
  package_id text,
  created_at timestamptz default now()
);

-- אבטחה: RLS
alter table public.profiles    enable row level security;
alter table public.video_jobs  enable row level security;
alter table public.revenue_txns enable row level security;

-- כל משתמש רואה רק את עצמו
create policy "self profile"  on public.profiles    for select using (id = auth.uid());
create policy "self videos"   on public.video_jobs  for select using (user_id = auth.uid());
create policy "self revenue"  on public.revenue_txns for select using (user_id = auth.uid());

-- אדמין רואה הכל
create policy "admin profiles" on public.profiles
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
-- חזרי על דפוס זה לטבלאות video_jobs ו-revenue_txns

-- הקצאת 25 קרדיט אוטומטית למשתמש חדש
create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end; $$ language plpgsql security definer;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
```

---

## 3. Env Vars

```bash
# .env.local (לאחר deploy ל-Lovable, הגדירי ב-Lovable Settings → Env)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # רק בצד שרת! לא להגיש לקליינט

STRIPE_SECRET_KEY=sk_live_...           # או sk_test_ במצב test
STRIPE_WEBHOOK_SECRET=whsec_...         # מהטראש של webhook ה-/api/stripe/webhook

REPLICATE_API_TOKEN=r8_...              # אופציונלי, ל-Whisper בענן
MODAL_TOKEN_ID=...                      # אופציונלי, ל-FFmpeg אסינכרוני
```

---

## 4. קבצים שצריך לשנות

### `src/lib/credits.ts`
החליפי את ה-localStorage ב-Supabase. מבנה זהה כדי שלא לשבור את ה-UI:

```ts
import { createClient } from "@supabase/supabase-js";
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function getCredits(): Promise<number> {
  const { data } = await supa.from("profiles").select("credits").single();
  return data?.credits ?? 0;
}
export async function setCredits(n: number) {
  await supa.from("profiles").update({ credits: n }).eq("id", (await supa.auth.getUser()).data.user!.id);
}
```

### `src/lib/adminStore.ts`
כל `listX()` הופך ל-`supa.from("X").select("*")`. ה-API של ה-UI לא משתנה.

### `src/app/api/checkout/route.ts`
החליפי את ה-stub ב:
```ts
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req) {
  const { packageId } = await req.json();
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
  const userId = /* from supabase session */;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: PRICE_IDS[pkg.id], quantity: 1 }],
    success_url: `${origin}/credits?status=success`,
    cancel_url:  `${origin}/credits?status=cancel`,
    metadata: { packageId, userId },
  });
  return NextResponse.json({ url: session.url });
}
```

### `src/app/api/stripe/webhook/route.ts` (חדש)
```ts
import Stripe from "stripe";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const sig = (await headers()).get("stripe-signature")!;
  const body = await req.text();
  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const { packageId, userId } = s.metadata!;
    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)!;
    await supaAdmin.from("profiles").update({ credits: { increment: pkg.credits } }).eq("id", userId);
    await supaAdmin.from("revenue_txns").insert({ user_id: userId, stripe_session_id: s.id, amount_ils: pkg.priceIls, credits_bought: pkg.credits, package_id: packageId });
  }
  return new Response("ok");
}
```

הגדירי URL זה בלוח הבקרה של Stripe → Webhooks.

### `src/app/admin/page.tsx`
הוסיפי בדיקת `is_admin` בעמוד; אחרת — redirect ל-`/`.

### `src/middleware.ts` (חדש)
```ts
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
export async function middleware(req) {
  const res = NextResponse.next();
  const supa = createMiddlewareClient({ req, res });
  await supa.auth.getSession();
  return res;
}
```

---

## 5. FFmpeg/Whisper בענן

Lovable לא יכול להריץ FFmpeg ארוך כי edge functions מוגבלות ל-30 שניות. שתי אופציות:

**אופציה A — Modal.com**: הסבי את `/api/render` ל-handler שמעלה את הוידאו ל-S3, מפעיל Modal job, מחזיר job_id, ו-/api/render/status מחזיר התקדמות.

**אופציה B — Replicate**: עבור Whisper בלבד, השתמשי במודל `openai/whisper` של Replicate. FFmpeg נשאר אצלך אם רץ בעבודות אסינכרוניות.

---

## 6. Storage

קבצים מקומיים → Supabase Storage bucket:

```ts
const { data, error } = await supa.storage.from("videos").upload(`${userId}/${jobId}.mp4`, file);
```

Bucket policy:
```sql
create policy "users upload to own folder" on storage.objects for insert with check (
  bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 7. Checklist לפני production

- [ ] כל ה-`localStorage` הוחלפו בקריאות Supabase
- [ ] עמוד `/admin` בודק `is_admin` (אחרת 401)
- [ ] Stripe ב-LIVE mode (לא test!)
- [ ] Webhook signing secret נבדק
- [ ] RLS פעיל על כל הטבלאות
- [ ] CORS ב-Supabase מגדיר רק את ה-domain של ה-Lovable
- [ ] תיוג GDPR: עמוד delete-account שמוחק את כל הנתונים
