import { get } from "@vercel/blob";
import { sql } from "@/lib/db";
import { audit, currentRep, loadForEdit } from "@/lib/rep";

// Streams one private contract file to the rep viewing it. Never cached, never public.
export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const rep = await currentRep();
  if (!rep) return new Response("Unauthorized", { status: 401 });
  const { fileId } = await params;

  const rows = (await sql()`SELECT submission_id, blob_key, mime_type FROM submission_files WHERE id = ${fileId}`) as {
    submission_id: string;
    blob_key: string;
    mime_type: string;
  }[];
  const file = rows[0];
  if (!file) return new Response("Not found", { status: 404 });

  const access = await loadForEdit(rep, file.submission_id);
  if ("error" in access) return new Response(access.error, { status: access.status });

  const blob = await get(file.blob_key, { access: "private" });
  if (!blob || !blob.stream) return new Response("Not found", { status: 404 });

  await audit(rep.id, "view_file", file.submission_id);
  return new Response(blob.stream, {
    headers: {
      "Content-Type": file.mime_type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
