import type { Metadata } from "next";
import IntakeForm from "@/components/IntakeForm";
import { TURNAROUND } from "@/lib/site";

export const metadata: Metadata = { title: "Start a free review" };

export default function SubmitPage() {
  return (
    <div className="wrap narrow" style={{ paddingTop: 40 }}>
      <h1>Start a free review</h1>
      <p className="lead" style={{ color: "var(--muted)" }}>
        Send us your contract and we&apos;ll send back a written review within {TURNAROUND}.
      </p>
      <IntakeForm />
    </div>
  );
}
