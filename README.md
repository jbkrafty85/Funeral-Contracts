# Funeral Contract Review

Free, rep-reviewed review of funeral, cemetery and preneed contracts. Families upload a contract; a reviewer
sends back a written review; each finished review leaves one de-identified training record.

Build plan: https://claude.ai/artifact/9oaLEZXsQAMXKT1m3WSuDi — structure and schema: `PROPOSAL.md`.

## Rules that must never be broken

- No family names, addresses, DOB, SSN or policy numbers are ever stored as fields.
- Uploaded contracts and contact info live only in the intake zone and are deleted on schedule.
- Training tables have no link back to a submission.

## Status

- Phase 0 — done: public AI chat and `/api/ask` removed (the old prompt is in git at `67c532c:api/ask.js`).
- Phase 1 — public intake: homepage, `/submit` form, private Blob uploads, `submissions` + `submission_files`,
  BotID + per-IP rate limit, email/text confirmation.
- Phase 2 — rep console at `/rep`: Microsoft 365 sign-in (reps table allowlist), queue with claim,
  review screen (contract viewer + structured form), AI assist (Claude Opus 5.5 + `lib/ai/knowledge-base.ts`),
  PII scan + "no personal details" checkbox.
- Phase 3 — Send writes the training records (fresh ids, no link back), deletes the uploads, and
  emails/texts a link to `/r/<token>` (30 days). Daily cron `/api/cron/purge` (08:00 UTC, production
  only) wipes contact info 7 days after sending, result pages after 30, leftover/orphan uploads.
- Phase 4 — `/rep/admin/stats` (admins): totals, reviews by contract month, prices by category,
  sellers, top red flags, and JSONL / CSV export (leaves out spot-check "major" reviews).
  `/rep/spotcheck`: ~10% of sent reviews are picked at Send for a second reviewer to grade.

## Setup (Vercel)

1. Storage → connect **Neon** (adds `DATABASE_URL`) and create a **private Blob** store (adds `BLOB_READ_WRITE_TOKEN`).
2. Settings → Environment Variables: add the rest from `.env.example`.
3. Migrations run automatically on every Vercel deploy (`vercel-build`).
4. Firewall → enable BotID.

## Local development

```bash
npm install
npx vercel env pull .env.local
npm run dev
```
