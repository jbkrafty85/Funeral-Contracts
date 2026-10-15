import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { sql } from "@/lib/db";

// Rep sign-in. The Entra app registration is single-tenant (AUTH_MICROSOFT_ENTRA_ID_ISSUER
// names your tenant), so only your organization's Microsoft 365 accounts can get this far;
// on top of that, the account must be listed in the reps table.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID],
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/rep/signin", error: "/rep/signin" },
  callbacks: {
    async signIn({ profile, user }) {
      const email = emailOf(profile, user);
      if (!email) return false;
      return Boolean(await ensureRep(email, (profile?.name as string | undefined) ?? user?.name ?? email));
    },
    async jwt({ token, profile, user }) {
      if (profile || user) token.email = emailOf(profile, user) ?? token.email;
      return token;
    },
  },
});

function emailOf(profile?: Record<string, unknown> | null, user?: { email?: string | null } | null) {
  const raw = (profile?.email as string | undefined) ?? (profile?.preferred_username as string | undefined) ?? user?.email;
  return raw?.trim().toLowerCase() || null;
}

// Returns the rep row, creating it for addresses in REP_ADMIN_EMAILS (the bootstrap admins).
async function ensureRep(email: string, displayName: string) {
  const db = sql();
  const rows = (await db`SELECT id FROM reps WHERE m365_email = ${email}`) as { id: string }[];
  if (rows[0]) return rows[0];

  const admins = (process.env.REP_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes(email)) return null;
  const created = (await db`
    INSERT INTO reps (m365_email, display_name, reviewer_code, role)
    VALUES (${email}, ${displayName}, ${await nextReviewerCode()}, 'admin')
    ON CONFLICT (m365_email) DO NOTHING
    RETURNING id
  `) as { id: string }[];
  return created[0] ?? null;
}

export async function nextReviewerCode() {
  const rows = (await sql()`SELECT count(*)::int AS n FROM reps`) as { n: number }[];
  return "R" + String(rows[0].n + 1).padStart(2, "0");
}
