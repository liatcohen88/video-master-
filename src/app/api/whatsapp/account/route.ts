/**
 * GET /api/whatsapp/account?phone=05...
 * Server-to-server (WhatsApp bot only, guarded by the shared secret).
 * Returns whether the phone is linked to a Master Video account, the display
 * name, the credit ("מאסטרים") balance, and a connect link if not linked.
 */
import { NextRequest, NextResponse } from "next/server";
import { botSecretOk } from "@/lib/apiAuth";
import { resolveUserByPhone, normalizePhone, connectToken } from "@/lib/whatsappHeadless";
import { getCreditBalance } from "@/lib/serverCredits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://master-video.co.il").replace(/\/$/, "");
const connectUrl = (phone: string) => {
  const p = normalizePhone(phone);
  return `${SITE_URL}/connect-whatsapp?phone=${encodeURIComponent(p)}&token=${connectToken(p)}`;
};

export async function GET(req: NextRequest) {
  if (!botSecretOk(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const phone = req.nextUrl.searchParams.get("phone") || "";
  if (!phone) return NextResponse.json({ error: "missing phone" }, { status: 400 });

  const user = await resolveUserByPhone(phone);
  if (!user) {
    return NextResponse.json({ linked: false, connectUrl: connectUrl(phone) });
  }

  let balance = 0;
  try { balance = await getCreditBalance(user.userId); } catch { balance = 0; }

  return NextResponse.json({ linked: true, name: user.name, balance });
}
