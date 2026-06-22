---
name: master-video
description: >-
  Full project context for Master Video (master-video.co.il) — a Hebrew RTL AI
  video-editing SaaS owned by Liat. Load this whenever working on this repo:
  architecture, stack, the credits/payments model, the Hetzner+Coolify deploy
  flow, hard conventions (gender-neutral Hebrew, token budget, never enter
  passwords/payment details), security/launch status, and known gotchas.
---

# Master Video — project skill

Hebrew RTL AI video-editing SaaS. Owner: **Liat**. Live: **https://master-video.co.il**.
Users upload a video → AI transcribes (Hebrew) → styled Reels subtitles + auto
effects (emoji on keywords, brand logos, drama, WOW, SFX) → export MP4.
Currency = **מאסטרים** (credits).

## Stack & infra
- **Next.js 15 App Router** + React + TypeScript + Tailwind. `src/app`, `src/components`, `src/lib`.
- **Supabase** — auth (email + Google OAuth), Postgres, Storage (public bucket `uploads`). Apple OAuth deferred ($99/yr).
- **Export engine = Remotion** (`EXPORT_ENGINE=remotion`, refunds on failure). `src/remotion/VideoComposition.tsx` + `src/lib/remotionRender.ts`. NO FFmpeg fallback (Liat's call). Render runs in background → `src/lib/renderJobs.ts` (disk under tmpdir) → client polls `/api/render-status` + `<ExportJobBadge>` (global, in layout).
- **Payments = Grow** hosted pages. Flow: `/credits` → `/buy/[pkg]` (writes `pending_payments`) → Grow payUrl → user pays → Grow webhook `/api/grow/webhook` credits by MATCHING THE PAID AMOUNT (₪10→25, ₪25→50, ₪50→100, ₪100→200). payUrls live in `src/lib/credits.ts`.
- **Host = Hetzner CX33 + Coolify.** Single Node container (ephemeral FS — tmpdir + in-memory state reset on every deploy).

## Deploy flow (commit → push `main` → Coolify auto-builds)
1. Commit to `main` (the project deploys from main; branching would NOT deploy).
2. `git push origin main` → Coolify auto-builds (~5-7 min, brief 503 during container swap).
3. Monitor: poll `application_deployment_queues` + curl the site, auto-retry the known **transient Coolify unpack failure** (build succeeds but final unpack intermittently fails → retry with an empty commit).
   ```
   docker exec coolify-db psql -U coolify -t -A -c "select status from application_deployment_queues where commit like '<sha>%' order by created_at desc limit 1;"
   ```
4. SSH: `ssh -i /c/Users/PC/.ssh/hetzner_rescue root@49.12.74.126` (keyless root). Disk is tight (~38G, ~19G free) — `docker image prune -af && docker builder prune -af` frees space WITHOUT downtime (running image is kept).
5. Verify `https://master-video.co.il/` returns 200.
- ⚠️ Don't deploy while Liat is actively editing/exporting — the container restart KILLS her in-flight export.
- `next build` skips TS/ESLint errors (2 baseline tsc errors are harmless). Supabase DDL is applied manually in the Supabase SQL editor (no direct DB connection from the server).

## Credits / payments model
- `profiles.credits` is the server source of truth. `src/lib/credits.ts` is the CLIENT mirror — UNTRUSTED.
- Server spend: `src/lib/serverCredits.ts` (`spendCredits` via `spend_credits` RPC, atomic; `refundCredits`). Export charges inside `/api/render-remotion`.
- Export refund-on-death: `src/lib/renderSpends.ts` (`render_spends` table) refunds credits even if the container restarts mid-render.

## Hard conventions (do NOT violate)
- **Gender-neutral Hebrew** in ALL user-facing strings (infinitive/plural/impersonal). Never feminine-only or masculine-only imperatives.
- **Token-cost aware** — Liat watches spend. Don't run multiple heavy multi-agent workflows at once; her live "stop, eats tokens" overrides any ultracode flag.
- **Never enter passwords / payment / bank details.** If Supabase asks to log in → stop, ask Liat. For SQL she prefers "drive my browser" (run it in her open Supabase SQL editor) while she watches.
- **Work style: do 90%, ask 10%.** Default to acting on reversible changes. Walk her through OAuth/setup/one-click steps.
- Emoji set = **Apple** (emoji-datasource-apple via jsDelivr; `appleEmojiUrl` in `twemoji.ts`).

## Admin
- `/admin` gated by Supabase login + email in `ADMIN_EMAILS` (default `liatcohen88@gmail.com,loliat8891@gmail.com`; see `apiAuth.ts`).
- Overview reads REAL data from `/api/admin/stats` (revenue_txns/profiles/user_videos), demo fallback. Live-visitors + new-signups panels are real. "איפוס נתוני דמו" clears only the local demo store (NEVER content — that was a footgun that called resetAllContent).
- `/api/admin/reset-launch` clears operational tables pre-launch (#145, Liat clicks it launch-day).

## Security / launch status (see memory: security-audit-results-20260622)
- FIXED+LIVE: profiles RLS self-credit + `add_credits` PUBLIC RPC (the 2 criticals, SQL), remove-logo-bg path-traversal, export refund ledger.
- DEFERRED (account-gated HIGH): multi-edit free-via-direct-API, `/api/credits/spend` trusts client amount, webhook double-credit on NULL `provider_txn_id`. Do with Liat's live ₪10 test.
- Still for launch: SEO (#44, Liat says mandatory), gender-neutral sweep (39 fixes staged), full content audit (#143), live ₪10 payment test.
- `LEGAL_DRAFT.md` (repo root) = ToS/Privacy draft for a lawyer to finalize (not legal advice).

## Gotchas
- The **Glob tool TIMES OUT** on this repo — use Grep (with a path) or PowerShell `Get-ChildItem`.
- Server build can OOM on the 4GB box (4GB swap added). Container FS is ephemeral.
- In-memory presence (`presenceStore.ts`) + render jobs (tmpdir) reset on deploy — fine for "now", not history.
- CMS overrides: code defaults in `contentStore.ts`; live values come from Supabase `content_overrides` via `/api/cms/overrides` + SSR'd into `window.__CMS_OVERRIDES__`. `resetAllContent()` is LOCAL-only (reload re-hydrates from server).

## Persistent memory
Auto-loaded each session from `C:\Users\PC\.claude\projects\E------------------\memory\` (MEMORY.md index). Check it for the live launch queue, recurring asks, and recovery notes. Update it as things change.
