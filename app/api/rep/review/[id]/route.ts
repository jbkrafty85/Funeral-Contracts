import { sql } from "@/lib/db";
import { loadForEdit, currentRep } from "@/lib/rep";
import { ReviewDraft } from "@/lib/review";

// Saves the rep's work-in-progress review on the submission (intake zone).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rep = await currentRep();
  if (!rep) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const access = await loadForEdit(rep, id);
  if ("error" in access) return Response.json({ error: access.error }, { status: access.status });

  const parsed = ReviewDraft.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Some fields are invalid." }, { status: 400 });

  await sql()`UPDATE submissions SET draft = ${JSON.stringify(parsed.data)}::jsonb, draft_updated_at = now() WHERE id = ${id}`;
  return Response.json({ ok: true, savedAt: new Date().toISOString() });
}
