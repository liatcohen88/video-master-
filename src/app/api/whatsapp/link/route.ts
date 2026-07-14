/**
 * POST /api/whatsapp/link   body: { phone, token }
 * Called by the /connect-whatsapp page as the LOGGED-IN user (real JWT). Links
 * the WhatsApp number to their account after verifying the signed connect token
 * (which proves the link was issued by our bot to that phone — so a user can't
 * hijack someone else's number by editing the ?phone= param).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { adminClient } from "@/lib/supabase";
import { normalizePhone, connectTokenValid } from "@/lib/whatsappHeadless";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  let body: { phone?: string; token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad body" }, { status: 400 }); }

  const phone = normalizePhone(body.phone);
  if (!phone || phone.length < 8) return NextResponse.json({ error: "bad phone" }, { status: 400 });
  if (!connectTokenValid(phone, body.token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 403 });
  }

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "server not configured" }, { status: 503 });

  // Keep the number unique: detach it from any other account first, then attach
  // it to this one (last verified linker wins — they control the phone).
  await admin.from("profiles").update({ whatsapp_phone: null }).eq("whatsapp_phone", phone).neq("id", user.id);
  const { error } = await admin.from("profiles").update({ whatsapp_phone: phone }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
