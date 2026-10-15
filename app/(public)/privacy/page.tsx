import type { Metadata } from "next";
import { CONSENT_DETAILS, CONSENT_FOOTNOTE, CONSENT_VERSION } from "@/lib/consent";

export const metadata: Metadata = { title: "Privacy and what we keep" };

// Must match the consent text word for word — both read lib/consent.ts.
export default function PrivacyPage() {
  return (
    <div className="wrap prose" style={{ paddingTop: 40 }}>
      <h1>Privacy and what we keep</h1>
      {CONSENT_DETAILS.map((d) => (
        <section key={d.heading}>
          <h2>{d.heading}</h2>
          <p>{d.body}</p>
        </section>
      ))}
      <p className="note">{CONSENT_FOOTNOTE}</p>
      <p className="note">Consent version {CONSENT_VERSION}</p>
    </div>
  );
}
