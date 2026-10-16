import { runAssist } from "@/lib/ai/assist";
import { sql } from "@/lib/db";
import { scanPii } from "@/lib/pii";
import { audit, currentRep, loadForEdit } from "@/lib/rep";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rep = await currentRep();
  if (!rep) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const access = await loadForEdit(rep, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  const files = (await sql()`
    SELECT blob_key, mime_type FROM submission_files WHERE submission_id = ${id} ORDER BY position
  `) as { blob_key: string; mime_type: string }[];
  if (!files.length) return Response.json({ error: "No files on this submission." }, { status: 404 });

  await audit(rep.id, "ai_assist", id, `files=${files.length}`);
  const result = await runAssist(files, access.submission.contract_type);
  if (!result.ok) return Response.json({ error: result.error }, { status: 502 });

  // Belt and braces: the prompt forbids personal details, but flag anything that slipped through.
  const d = result.draft;
  const piiWarnings = scanPii([d.advice, ...d.line_items.map((li) => li.description), ...d.red_flags.map((f) => f.note)].join("\n"));
  return Response.json({ draft: d, skipped: result.skipped, fallbackModel: result.fallbackModel, piiWarnings });
}
