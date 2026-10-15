import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/auth";
import { requireRep } from "@/lib/rep";

export const metadata: Metadata = { title: "Review console", robots: { index: false } };

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const rep = await requireRep();
  return (
    <div className="console">
      <nav className="console-nav">
        <div className="wrap wide">
          <Link href="/rep">Queue</Link>
          {rep.role === "admin" && <Link href="/rep/admin/reps">Reviewers</Link>}
          <span className="spacer" />
          <span className="note">{rep.display_name} · {rep.reviewer_code}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/rep/signin" });
            }}
          >
            <button className="linklike" type="submit">Sign out</button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
