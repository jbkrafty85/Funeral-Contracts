import { randomUUID } from "node:crypto";
import { checkBotId } from "botid/server";
import { z } from "zod";
import { deleteBlobs, verifyPrivateUpload, type VerifiedBlob } from "@/lib/blob";
import { CONSENT_VERSION } from "@/lib/consent";
import { normalizeEmail, normalizeUsPhone } from "@/lib/contact";
import { sql } from "@/lib/db";
import { sendReceived } from "@/lib/notify";
import { allow, clientIp } from "@/lib/rate-limit";
import { ALLOWED_TYPES, CONTRACT_TYPES, MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/site";

const Body = z.object({
  contractType: z.enum(CONTRACT_TYPES.map((t) => t.value) as [string, ...string[]]),
  contactMethod: z.enum(["email", "sms"]),
  contactValue: z.string().max(254),
  consent: z.literal(true),
  consentVersion: z.literal(CONSENT_VERSION),
  files: z.array(z.string()).min(1).max(MAX_FILES),
});

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  if ((await checkBotId()).isBot) return fail(403, "Access denied");
  if (!(await allow(clientIp(request.headers), "submit", 5, 60))) {
    return fail(429, "Too many submissions. Please try again in an hour.");
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "Please check the form and try again.");
  const { contractType, contactMethod, contactValue, files } = parsed.data;

  const contact = contactMethod === "email" ? normalizeEmail(contactValue) : normalizeUsPhone(contactValue);
  if (!contact) {
    return fail(400, contactMethod === "email" ? "Please enter a valid email address." : "Please enter a valid US mobile number.");
  }

  const pathnames = [...new Set(files)];
  let blobs: VerifiedBlob[];
  try {
    blobs = await Promise.all(pathnames.map(verifyPrivateUpload));
  } catch {
    return fail(400, "One of your files didn't upload correctly. Please try again.");
  }
  const total = blobs.reduce((n, b) => n + b.size, 0);
  if (total > MAX_TOTAL_BYTES || blobs.some((b) => !ALLOWED_TYPES.includes(b.contentType))) {
    await deleteBlobs(pathnames);
    return fail(400, "Files must be PDFs or photos, 20 MB total at most.");
  }

  const id = randomUUID();
  const db = sql();
  try {
    await db.transaction([
      db`INSERT INTO submissions (id, contact_method, contact_value, consent_version, consent_at, contract_type)
         VALUES (${id}, ${contactMethod}, ${contact}, ${CONSENT_VERSION}, now(), ${contractType})`,
      ...blobs.map(
        (b, i) => db`INSERT INTO submission_files (submission_id, blob_key, mime_type, bytes, position)
                     VALUES (${id}, ${b.pathname}, ${b.contentType}, ${b.size}, ${i})`,
      ),
      db`INSERT INTO audit_log (action, submission_id, detail) VALUES ('submit', ${id}, ${`files=${blobs.length}`})`,
    ]);
  } catch (err) {
    // blob_key is UNIQUE, so a replayed request can't attach someone else's files.
    console.error("submission insert failed:", err instanceof Error ? err.message : "unknown");
    return fail(400, "We couldn't save your submission. Please try again.");
  }

  await sendReceived(contactMethod, contact);
  return Response.json({ ok: true });
}
