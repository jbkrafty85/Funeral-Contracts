import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nextReviewerCode } from "@/auth";
import { sql } from "@/lib/db";
import { normalizeEmail } from "@/lib/contact";
import { audit, requireRep } from "@/lib/rep";

async function requireAdmin() {
  const rep = await requireRep();
  if (rep.role !== "admin") redirect("/rep");
  return rep;
}

async function addRep(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const role = formData.get("role") === "admin" ? "admin" : "rep";
  if (!email || !name) return;
  await sql()`
    INSERT INTO reps (m365_email, display_name, reviewer_code, role)
    VALUES (${email}, ${name}, ${await nextReviewerCode()}, ${role})
    ON CONFLICT (m365_email) DO NOTHING
  `;
  await audit(admin.id, "add_rep", null, role);
  revalidatePath("/rep/admin/reps");
}

async function removeRep(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === admin.id) return;
  // Release anything they had claimed so it returns to the queue.
  await sql().transaction((db) => [
    db`UPDATE submissions SET status = 'new', claimed_by = NULL WHERE claimed_by = ${id} AND status = 'in_review'`,
    db`UPDATE submissions SET claimed_by = NULL WHERE claimed_by = ${id}`,
    db`DELETE FROM reps WHERE id = ${id}`,
  ]);
  await audit(admin.id, "remove_rep", null);
  revalidatePath("/rep/admin/reps");
}

export default async function RepsPage() {
  const me = await requireAdmin();
  const reps = (await sql()`SELECT id, m365_email, display_name, reviewer_code, role FROM reps ORDER BY reviewer_code`) as {
    id: string;
    m365_email: string;
    display_name: string;
    reviewer_code: string;
    role: string;
  }[];

  return (
    <div className="wrap wide" style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: "1.8rem" }}>Reviewers</h1>
      <p className="note">Only Microsoft 365 accounts listed here can sign in. The reviewer code is the only reviewer identifier stored with training data.</p>
      <table className="queue">
        <thead>
          <tr><th>Code</th><th>Name</th><th>Microsoft 365 email</th><th>Role</th><th /></tr>
        </thead>
        <tbody>
          {reps.map((r) => (
            <tr key={r.id}>
              <td>{r.reviewer_code}</td>
              <td>{r.display_name}</td>
              <td>{r.m365_email}</td>
              <td>{r.role}</td>
              <td style={{ textAlign: "right" }}>
                {r.id !== me.id && (
                  <form action={removeRep}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="linklike" type="submit">Remove</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Add a reviewer</h2>
      <form action={addRep} className="inline-form">
        <input name="name" placeholder="Name" required aria-label="Name" />
        <input name="email" type="email" placeholder="name@yourorg.com" required aria-label="Microsoft 365 email" />
        <select name="role" aria-label="Role" defaultValue="rep">
          <option value="rep">Reviewer</option>
          <option value="admin">Admin</option>
        </select>
        <button className="button small" type="submit">Add</button>
      </form>
    </div>
  );
}
