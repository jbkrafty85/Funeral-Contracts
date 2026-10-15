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

## Setup (Vercel)

1. Storage → connect **Neon** (adds `DATABASE_URL`) and create a **private Blob** store (adds `BLOB_READ_WRITE_TOKEN`).
2. Settings → Environment Variables: add the rest from `.env.example`.
3. Run the schema once: `DATABASE_URL=... npm run db:migrate`
4. Firewall → enable BotID.

## Local development

```bash
npm install
npx vercel env pull .env.local
npm run dev
```
