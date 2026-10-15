import { notFound, redirect } from "next/navigation";
import ReviewWorkspace from "@/components/ReviewWorkspace";
import { sql } from "@/lib/db";
import { audit, loadForEdit, requireRep } from "@/lib/rep";
import { emptyDraft, ReviewDraft } from "@/lib/review";

async function release(formData: FormData) {
  "use server";
  const rep = await requireRep();
  const id = String(formData.get("id"));
  const access = await loadForEdit(rep, id);
  if ("error" in access) redirect("/rep");
  await sql()`UPDATE submissions SET status = 'new', claimed_by = NULL WHERE id = ${id} AND status = 'in_review'`;
  await audit(rep.id, "release", id);
  redirect("/rep");
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const rep = await requireRep();
  const { id } = await params;
  const access = await loadForEdit(rep, id);
  if ("error" in access) {
    if (access.status === 404) notFound();
    redirect("/rep?status=in_review");
  }
  const s = access.submission;

  const files = (await sql()`
    SELECT id, mime_type, bytes FROM submission_files WHERE submission_id = ${id} ORDER BY position
  `) as { id: string; mime_type: string; bytes: number }[];

  const saved = ReviewDraft.safeParse(s.draft);
  const draft = saved.success ? saved.data : emptyDraft(s.contract_type);

  return (
    <ReviewWorkspace
      submissionId={id}
      receivedAt={s.created_at}
      familyContractType={s.contract_type}
      files={files}
      initialDraft={draft}
      draftSavedAt={s.draft_updated_at}
      releaseAction={release}
    />
  );
}
