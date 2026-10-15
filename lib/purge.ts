import "server-only";
import { del, list } from "@vercel/blob";
import { sql } from "./db";

export type PurgeCounts = {
  contactsDeleted: number;
  resultsExpired: number;
  leftoverFilesDeleted: number;
  orphanUploadsDeleted: number;
  rateLimitRowsDeleted: number;
};

// Daily job. Every step is idempotent and only removes data that is past its scheduled
// deletion, so running it early or twice does no harm.
export async function runPurge(): Promise<PurgeCounts> {
  const db = sql();

  // 1. Contact info: 7 days after the review was sent.
  const contacts = (await db`
    UPDATE submissions SET contact_value = NULL, status = 'purged'
    WHERE status = 'sent' AND purge_after <= now()
    RETURNING id
  `) as { id: string }[];

  // 2. The family's review page: 30 days after sending.
  const results = (await db`
    UPDATE submissions SET result = NULL, result_token = NULL
    WHERE result_token IS NOT NULL AND sent_at <= now() - interval '30 days'
    RETURNING id
  `) as { id: string }[];

  // 3. Uploaded files that should already be gone (Send deletes them; this retries failures).
  const leftovers = (await db`
    SELECT f.id, f.blob_key FROM submission_files f JOIN submissions s ON s.id = f.submission_id
    WHERE s.status IN ('sent', 'purged')
  `) as { id: string; blob_key: string }[];
  if (leftovers.length) {
    await del(leftovers.map((f) => f.blob_key));
    await db`DELETE FROM submission_files WHERE id = ANY(${leftovers.map((f) => f.id)}::uuid[])`;
  }

  // 4. Uploads from forms that were never submitted (older than a day, not attached to anything).
  const known = new Set(((await db`SELECT blob_key FROM submission_files`) as { blob_key: string }[]).map((r) => r.blob_key));
  const cutoff = Date.now() - 24 * 3_600_000;
  const orphans: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "intake/", cursor, limit: 1000 });
    for (const b of page.blobs) if (!known.has(b.pathname) && b.uploadedAt.getTime() < cutoff) orphans.push(b.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (orphans.length) await del(orphans);

  // 5. Old rate-limit windows.
  const rl = (await db`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day' RETURNING key`) as unknown[];

  const counts: PurgeCounts = {
    contactsDeleted: contacts.length,
    resultsExpired: results.length,
    leftoverFilesDeleted: leftovers.length,
    orphanUploadsDeleted: orphans.length,
    rateLimitRowsDeleted: rl.length,
  };
  await db`INSERT INTO audit_log (action, detail) VALUES ('purge', ${JSON.stringify(counts)})`;
  return counts;
}
