import type { Metadata } from "next";
import Link from "next/link";
import { TURNAROUND } from "@/lib/site";

export const metadata: Metadata = { title: "We got your contract" };

export default function ThanksPage() {
  return (
    <div className="wrap narrow" style={{ paddingTop: 56 }}>
      <h1>We got your contract</h1>
      <p>
        We&apos;ll send your review within {TURNAROUND}. You&apos;ll get a short confirmation by email or text in the
        next few minutes.
      </p>
      <p>
        If you&apos;re deciding on something now, you don&apos;t have to sign today. You have the right to ask any
        funeral home for its itemized price list.
      </p>
      <Link href="/" className="button secondary">Back to home</Link>
    </div>
  );
}
