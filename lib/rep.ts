import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sql } from "./db";

export type Rep = { id: string; m365_email: string; display_name: string; reviewer_code: string; role: "rep" | "admin" };

export async function currentRep(): Promise<Rep | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const rows = (await sql()`SELECT id, m365_email, display_name, reviewer_code, role FROM reps WHERE m365_email = ${email}`) as Rep[];
  return rows[0] ?? null;
}

// For pages: send anyone who isn't a rep to the sign-in page.
export async function requireRep(): Promise<Rep> {
  const rep = await currentRep();
  if (!rep) redirect("/rep/signin?error=AccessDenied");
  return rep;
}

export async function audit(repId: string, action: string, submissionId: string | null, detail?: string) {
  await sql()`INSERT INTO audit_log (rep_id, action, submission_id, detail) VALUES (${repId}, ${action}, ${submissionId}, ${detail ?? null})`;
}

export type SubmissionRow = {
  id: string;
  created_at: string;
  status: "new" | "in_review" | "sent" | "purged";
  contract_type: string;
  claimed_by: string | null;
  draft: unknown;
  draft_updated_at: string | null;
};

// A rep may work on a submission they claimed; admins may work on any.
export async function loadForEdit(rep: Rep, id: string) {
  const rows = (await sql()`
    SELECT id, created_at, status, contract_type, claimed_by, draft, draft_updated_at
    FROM submissions WHERE id = ${id}
  `) as SubmissionRow[];
  const s = rows[0];
  if (!s || s.status === "purged") return { error: "Not found", status: 404 } as const;
  if (s.status !== "in_review") return { error: "This submission isn't in review.", status: 409 } as const;
  if (s.claimed_by !== rep.id && rep.role !== "admin") return { error: "Another rep has claimed this one.", status: 403 } as const;
  return { submission: s } as const;
}
