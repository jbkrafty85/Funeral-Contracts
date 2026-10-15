import type { Metadata } from "next";
import { signIn } from "@/auth";

export const metadata: Metadata = { title: "Reviewer sign-in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  AccessDenied: "That Microsoft account isn't set up as a reviewer. Ask an admin to add you.",
  Configuration: "Sign-in isn't configured yet. Check the Microsoft Entra settings in Vercel.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="wrap narrow" style={{ paddingTop: 64 }}>
      <h1>Reviewer sign-in</h1>
      <p style={{ color: "var(--muted)" }}>For contract reviewers only. Sign in with your organization&apos;s Microsoft 365 account.</p>
      {error && <p className="error">{ERRORS[error] ?? "Sign-in failed. Please try again."}</p>}
      <form
        action={async () => {
          "use server";
          await signIn("microsoft-entra-id", { redirectTo: "/rep" });
        }}
      >
        <button className="button" type="submit">Sign in with Microsoft</button>
      </form>
    </div>
  );
}
