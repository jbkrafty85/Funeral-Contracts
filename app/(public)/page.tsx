import Link from "next/link";
import { CONTRACT_TYPES, TURNAROUND } from "@/lib/site";

export default function Home() {
  return (
    <div className="wrap">
      <section className="hero">
        <h1>Free review of your funeral, cemetery or preneed contract</h1>
        <p className="lead">
          Upload your contract or price list. A contract reviewer goes through it line by line and tells you what looks
          fair, what doesn&apos;t, and what to ask about. It costs nothing.
        </p>
        <Link href="/submit" className="button">Start a free review</Link>
      </section>

      <section className="cards" aria-label="Contracts we review">
        {CONTRACT_TYPES.filter((t) => t.card).map((t) => (
          <div className="card" key={t.value}>
            <h3>{t.card}</h3>
            <p>{t.blurb}</p>
          </div>
        ))}
      </section>

      <section className="narrow">
        <h2>How it works</h2>
        <ol className="steps">
          <li>Upload a PDF or photos of your contract, statement or price list.</li>
          <li>A contract reviewer goes through every line and checks it against typical prices and your rights.</li>
          <li>Within {TURNAROUND}, we send you a written review by email or text.</li>
        </ol>
        <p className="note" style={{ marginTop: 24 }}>
          We keep prices, the seller&apos;s name and our advice to help future families — never your name or personal
          details. Your upload is deleted once your review is sent. <Link href="/privacy">Details</Link>
        </p>
      </section>
    </div>
  );
}
