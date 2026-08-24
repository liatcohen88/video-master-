# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repository.

## What this is

**Master Video** (`master-video.co.il`) — a Hebrew, RTL, AI video-editing SaaS.
A user uploads a video → Whisper transcribes it (Hebrew) → the app generates
styled Reels/TikTok subtitles plus automatic effects (emoji on keywords, brand
logos, zoom, drama, SFX) → exports an MP4.

The in-app currency is **מאסטרים** (credits). New users get 25 free.

`package.json` still calls the project `hebrew-subtitles-studio` — that's the
original name; the product is Master Video.

## Commands

```bash
npm install                       # .npmrc forces legacy-peer-deps (lottie-react vs React 19)
pip install -r requirements.txt   # faster-whisper, for /api/transcribe
npm run dev                       # http://localhost:3001  (NOT 3000)
npm run build                     # next build
npm run start                     # production server, port 3001
npm run lint                      # next lint
```

There is **no test suite** and no ESLint config file — `next lint` runs Next's
defaults. Verification is manual: build the app and exercise the flow.

`next.config.ts` sets `typescript.ignoreBuildErrors` and
`eslint.ignoreDuringBuilds` to `true`, so **the build will not catch type
errors for you**. A couple of baseline `tsc` errors are known and harmless.
Read your diff carefully instead of relying on the build.

## Stack

Next.js 15 (App Router) · React 19 RC · TypeScript (strict) · Tailwind ·
Supabase (auth + Postgres + Storage) · Remotion (export) · FFmpeg ·
Python faster-whisper · Node 20.

Path alias: `@/*` → `./src/*`.

## Layout

```
src/
  app/
    page.tsx              # THE editor (2.5k lines) — upload → transcribe → style → export
    admin/page.tsx        # admin panel + CMS (3k lines)
    multi/page.tsx        # multi-video AI editor
    layout.tsx            # html lang="he" dir="rtl", fonts, SSR'd CMS overrides, GA + Clarity
    api/                  # ~35 route handlers, all `runtime = "nodejs"`
  components/             # ~50 React components (VideoPreview + EffectsPanel are the big ones)
  lib/                    # domain logic — see below
  remotion/               # VideoComposition.tsx = the export renderer
scripts/                  # transcribe.py, analyze_video.py, lottie/sfx download + render helpers
supabase/                 # schema.sql + migrations/ (applied MANUALLY in the Supabase SQL editor)
public/sfx/               # 23MB of SFX     public/lottie/  2.6MB of animations
assets/fonts/             # Hebrew fonts
"וידאו מאסטר"/            # Liat's raw Premiere footage — source material, not app code
```

### Key modules in `src/lib`

| File | Role |
| --- | --- |
| `types.ts` | `EditMode`, `VideoEffects`, `Subtitle`, `SubtitleStyle` — the domain vocabulary |
| `credits.ts` | **CLIENT** pricing mirror: packages, `calcDynamicCost`. Untrusted |
| `serverCredits.ts` | **SERVER** truth: `spendCredits` / `refundCredits` / `getCreditBalance` |
| `renderSpends.ts` | Persistent spend ledger — refunds even if the container dies mid-render |
| `renderJobs.ts` | Background render jobs on disk under `tmpdir()` |
| `remotionRender.ts` | Bundles + renders the Remotion composition (per-request `publicDir`) |
| `apiAuth.ts` | `requireUser` / `botSecretOk` — use these in every protected route |
| `contentStore.ts` | CMS defaults; every string here is editable from `/admin` |
| `modeCapabilities.ts` | What each `EditMode` may expose in the editor |
| `whatsappHeadless.ts` | Phone↔account linking, HMAC connect/result tokens |
| `supabase.ts` | `browserClient()` (anon, safe) vs `adminClient()` (service role, **server only**) |

## Core flows

### Export (the money path)

Client `exportProject()` in `src/app/page.tsx` dispatches on
`NEXT_PUBLIC_EXPORT_ENGINE`:

- `"remotion"` → `/api/render-remotion` (headless Chromium; the real path)
- anything else → `/api/render` (legacy FFmpeg filter-graph)

`/api/render-remotion` is where money changes hands, in this order: auth →
rate-limit (3/min/user) → charge via `spendCredits` → `recordSpend` in the
ledger → create a job → return `jobId` immediately → render in the background
behind an `RENDER_SLOTS`-wide semaphore. The client polls
`/api/render-status/[jobId]` and downloads from `/api/render-result/[jobId]`;
`<ExportJobBadge>` (mounted globally in `layout.tsx`) shows progress.

On failure or container death, `reconcileSpend` / `sweepStaleSpends` flip the
ledger row `spent → refunded` exactly once and refund. **Never charge outside
this ledger pattern** — a charge without a ledger row is a charge that can't be
refunded.

Transcription (`/api/transcribe`) is **free** — only the render charges. A
WhatsApp video is therefore one charge, same as the site.

### Payments

Live gateway is **Grow** (Israeli), via hosted payment pages:

`/credits` → `/buy/[pkg]` (writes `pending_payments`) → Grow `payUrl` → user
pays → Grow calls `/api/grow/webhook` → credits granted.

Credits are derived from **the amount Grow actually charged**
(`creditsForAmount` in `fulfillment.ts`: ₪10→25, ₪25→50, ₪50→100, ₪100→200),
never from a client-supplied field — a checkout custom field can claim
anything. The unique `(provider, provider_txn_id)` index on `revenue_txns`
makes the webhook idempotent.

`src/lib/payplus.ts` and `/api/payplus/webhook` are an **earlier, unused**
gateway. `/api/make/webhook` is a Make.com bridge alternative. Grow is the one
in production.

### WhatsApp bot

`/api/whatsapp/cloud-webhook` holds the full conversation logic server-side
(Meta Cloud API): video in → interactive style menu → `/api/whatsapp/process`
→ transcribe + render → MP4 back, plus a deep link
`/?waedit=<jobId>&token=<hmac>` that reopens the exact project in the editor.

The bot authenticates server-to-server with `MV_BOT_SECRET`. `requireUser`
honours `x-mv-bot-secret` + `x-mv-user-id` as **bot delegation** — it charges
the real user's credits and respects the render semaphore, but never grants
admin. Conversation state is in-memory, so a deploy mid-conversation loses
pending menus.

### CMS

Code defaults live in `contentStore.ts`. Live values come from Supabase
`content_overrides` through `/api/cms/overrides`, and `layout.tsx` SSRs them
into `window.__CMS_OVERRIDES__` so Liat's copy renders on the first paint.

`resetAllContent()` is **local-only** — a reload re-hydrates from the server.
The admin "איפוס נתוני דמו" button must clear only the local demo store; wiring
it to `resetAllContent` was a past footgun.

### Admin

`/admin` is gated by Supabase login **and** email in `ADMIN_EMAILS` (default
`liatcohen88@gmail.com,loliat8891@gmail.com`). The server-side allowlist in
`apiAuth.ts` intentionally repeats the same default as the client gate so the
two can't drift. `/api/admin/reset-launch` clears operational tables pre-launch.

## Conventions — do not violate

- **Gender-neutral Hebrew in every user-facing string.** Use infinitive,
  plural, or impersonal forms. Never feminine-only or masculine-only
  imperatives. This applies to UI copy, errors, toasts, and bot messages.
- **RTL first.** The whole app is `dir="rtl"`. Use CSS logical properties;
  check anything positional in both directions.
- **Never trust the client for money.** `credits.ts` is a display mirror.
  Every balance change goes through `serverCredits.ts` / the `spend_credits`
  and `add_credits` RPCs (SECURITY DEFINER, service-role only).
- **`adminClient()` is server-only.** Never import it into a client component.
- **Emoji set is Apple** (emoji-datasource-apple via jsDelivr, `twemoji.ts`).
- **Comments explain *why*.** This codebase documents the reasoning behind
  odd-looking decisions — nixpacks apt pins, per-request Remotion bundling,
  CSP entries. Match that. If you work around something surprising, say why.
- **Commit messages: short imperative subject + a body explaining the why**,
  including the user feedback that prompted it where relevant. See
  `git log` for the house style.
- **Never enter passwords, payment, or bank details.** If Supabase asks for a
  login, stop and ask Liat. She prefers to run SQL herself in her open
  Supabase SQL editor while you walk her through it.
- **Work style: do 90%, ask 10%.** Act on reversible changes; check in on
  anything that touches money, auth, or live user data.
- **Be token-frugal.** Don't fan out heavy multi-agent workflows unasked.

## Deploy

Production is a **single Node container on Hetzner (CX33) + Coolify**.

The site deploys from **`main`** — pushing to any other branch does **not**
deploy. Coolify auto-builds on push (~5–7 min, with a brief 503 during the
container swap).

- The container filesystem is **ephemeral**: `tmpdir()` render jobs,
  `presenceStore` presence, and WhatsApp conversation state all reset on every
  deploy. Fine for "right now", useless as history.
- **Don't deploy while Liat is exporting** — the restart kills her in-flight
  render.
- Supabase DDL is applied **manually** in the Supabase SQL editor. Files in
  `supabase/migrations/` are the record, not an automatic pipeline.
- A known transient Coolify unpack failure (build succeeds, final unpack
  fails) is fixed by retrying with an empty commit.
- Disk is tight. `docker image prune -af && docker builder prune -af` frees
  space without downtime — the running image is kept.

`nixpacks.toml` carries hard-won build details: Chromium is deliberately *not*
in `nixPkgs` (image size), Remotion's headless shell is pre-baked into
`node_modules/.remotion` at build time so the first export after a deploy
doesn't cold-download, Ubuntu 24.04 needs the `t64` library variants, emoji
fonts must be installed or exports render tofu boxes, and `LD_LIBRARY_PATH`
must **not** be set globally (the transcribe route injects Nix lib paths into
the Python child only).

## Environment

See `.env.example`. Everything degrades gracefully when unset — missing
Supabase config falls back to localStorage, missing payment keys fall back to a
dev stub. Vars actually read by the code:

```
NEXT_PUBLIC_SUPABASE_URL  NEXT_PUBLIC_SUPABASE_ANON_KEY  SUPABASE_SERVICE_ROLE_KEY
GROW_PAGE_CODE  GROW_USER_ID  GROW_API_KEY  GROW_WEBHOOK_SECRET  GROW_USE_PROD
PAYPLUS_*  MAKE_WEBHOOK_SECRET                       # alternative gateways
MV_BOT_SECRET  MV_INTERNAL_URL  MV_OWNER_PHONE       # WhatsApp bot
WA_CLOUD_TOKEN  WA_CLOUD_PHONE_ID  WA_VERIFY_TOKEN   # WhatsApp Cloud API
OPENAI_API_KEY  PYTHON_PATH  FFMPEG_PATH  FFPROBE_PATH  CHROME_BIN
NEXT_PUBLIC_EXPORT_ENGINE  RENDER_SLOTS  RENDER_CONCURRENCY  MAX_UPLOAD_MB
REMOTION_LAMBDA  REMOTION_FUNCTION_NAME  REMOTION_SERVE_URL  REMOTION_BUCKET_NAME
AWS_*  REMOTION_AWS_*                                # Lambda render path (flagged off)
ADMIN_EMAILS  NEXT_PUBLIC_ADMIN_EMAILS
NEXT_PUBLIC_SITE_URL  NEXT_PUBLIC_GA_MEASUREMENT_ID  NEXT_PUBLIC_CLARITY_ID
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION  CALLMEBOT_APIKEY  CALLMEBOT_PHONE
```

## Gotchas

- **The Glob tool times out on this repo.** Use `Grep` with an explicit path,
  or `find` / `ls` via Bash.
- **`npm run dev` is port 3001**, not 3000.
- `next.config.ts` maintains a hand-tuned CSP. Adding a third-party script,
  font, or media host means editing it — several entries exist because a
  feature silently broke without them (Clarity was blocked; Supabase-hosted
  SFX played silently until `media-src https:` was added).
- Native modules (`@napi-rs/canvas`, `ffmpeg-static`, `@remotion/*`) are listed
  in `serverExternalPackages` — webpack cannot bundle their `.node` binaries.
  Adding a similar dependency means adding it there too.
- The 4GB box can OOM during `next build`; swap is configured.
- `STYLE_PRESETS` in `src/app/page.tsx` and the preset table in
  `autoStyleServer.ts` are parallel copies — **keep them in sync**.
- `src/lib/rateLimit.ts` is in-memory per container. Fine for one box; it
  would need Redis to scale out.

## Repo docs, and how much to trust them

- `README.md` — **partly stale**. It describes Lovable hosting, PayPlus, and a
  planned Modal.com migration. Reality: Hetzner + Coolify, Grow, Remotion.
  Treat the feature list as current and the deploy/payments sections as history.
- `LOVABLE_MIGRATION.md`, `DEPLOY_TO_LOVABLE.md` — historical plans, not the
  current deployment.
- `LOTTIE_PLAN.md`, `PREMIERE_PLUGIN.md` — feature notes.
- `LEGAL_DRAFT.md` — a ToS/Privacy draft for a lawyer to finalize. Not legal
  advice, not published copy.
- `.claude/skills/master-video/SKILL.md` — the live project brief: launch
  queue, security status, SSH details, current priorities. Read it first.

When the code and a Markdown file disagree, **the code is right**.
