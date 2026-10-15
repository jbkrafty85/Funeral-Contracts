"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONSENT_DETAILS, CONSENT_FOOTNOTE, CONSENT_LABEL, CONSENT_VERSION } from "@/lib/consent";
import { normalizeEmail, normalizeUsPhone } from "@/lib/contact";
import { ALLOWED_TYPES, CONTRACT_TYPES, MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/site";

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
};

// iPhones sometimes hand over HEIC photos with an empty type; fall back to the extension.
function mimeOf(f: File) {
  if (f.type) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase();
  return Object.entries(EXT).find(([, e]) => e === ext || (ext === "jpeg" && e === "jpg"))?.[0] ?? "";
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(1) + " MB";

export default function IntakeForm() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [contractType, setContractType] = useState("");
  const [method, setMethod] = useState<"email" | "sms">("email");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const busy = status !== "";

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!ALLOWED_TYPES.includes(mimeOf(f))) {
        setError(`"${f.name}" isn't a PDF or photo.`);
        continue;
      }
      next.push(f);
    }
    if (next.length > MAX_FILES) setError(`You can send up to ${MAX_FILES} files.`);
    setFiles(next.slice(0, MAX_FILES));
  }

  const total = files.reduce((n, f) => n + f.size, 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!files.length) return setError("Please add your contract — a PDF or photos of each page.");
    if (total > MAX_TOTAL_BYTES) return setError(`Files add up to ${mb(total)}. The limit is ${mb(MAX_TOTAL_BYTES)}.`);
    if (!contractType) return setError("Please choose what kind of contract this is.");
    const ok = method === "email" ? normalizeEmail(contact) : normalizeUsPhone(contact);
    if (!ok) return setError(method === "email" ? "Please enter a valid email address." : "Please enter a valid US mobile number.");
    if (!consent) return setError("Please check the box to agree before sending.");

    try {
      const pathnames: string[] = [];
      for (const [i, f] of files.entries()) {
        setStatus(`Uploading file ${i + 1} of ${files.length}…`);
        const type = mimeOf(f);
        // Random name — the original filename often includes the family's name.
        const blob = await upload(`intake/${crypto.randomUUID()}.${EXT[type]}`, f, {
          access: "private",
          handleUploadUrl: "/api/upload",
          contentType: type,
          multipart: f.size > 5 * 1024 * 1024,
        });
        pathnames.push(blob.pathname);
      }

      setStatus("Sending…");
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractType,
          contactMethod: method,
          contactValue: contact,
          consent: true,
          consentVersion: CONSENT_VERSION,
          files: pathnames,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
      router.push("/submit/thanks");
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <fieldset disabled={busy}>
        <span className="label" id="files-label">Your contract</span>
        <p className="hint">A PDF, or a clear photo of each page. Up to {MAX_FILES} files, {mb(MAX_TOTAL_BYTES)} total.</p>
        <div
          className={"drop" + (over ? " over" : "")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
        >
          <label>
            <input
              type="file"
              multiple
              accept="application/pdf,image/*,.heic,.heif"
              aria-labelledby="files-label"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            />
            <span className="button secondary">Choose files or take photos</span>
          </label>
          <p className="note" style={{ margin: ".6rem 0 0" }}>or drag them here</p>
        </div>
        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f, i) => (
              <li key={i}>
                <span className="name">{f.name}</span>
                <span style={{ display: "flex", gap: 12, flex: "none" }}>
                  <span className="note">{mb(f.size)}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset disabled={busy}>
        <legend>What kind of contract is this?</legend>
        <div className="choices">
          {CONTRACT_TYPES.map((t) => (
            <label className="choice" key={t.value}>
              <input type="radio" name="contractType" value={t.value} checked={contractType === t.value} onChange={() => setContractType(t.value)} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={busy}>
        <legend>Where should we send your review?</legend>
        <div className="inline-choices">
          <label className="choice">
            <input type="radio" name="method" checked={method === "email"} onChange={() => { setMethod("email"); setContact(""); }} />
            Email
          </label>
          <label className="choice">
            <input type="radio" name="method" checked={method === "sms"} onChange={() => { setMethod("sms"); setContact(""); }} />
            Text message
          </label>
        </div>
        <input
          type={method === "email" ? "email" : "tel"}
          inputMode={method === "email" ? "email" : "tel"}
          autoComplete={method === "email" ? "email" : "tel"}
          placeholder={method === "email" ? "you@example.com" : "Mobile number"}
          aria-label={method === "email" ? "Email address" : "Mobile number"}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <p className="note" style={{ margin: ".5rem 0 0" }}>We delete this 7 days after your review is sent.</p>
      </fieldset>

      <fieldset disabled={busy}>
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{CONSENT_LABEL}</span>
        </label>
        <details>
          <summary>Details</summary>
          <div className="details-body">
            {CONSENT_DETAILS.map((d) => (
              <p key={d.heading}><strong>{d.heading}:</strong> {d.body}</p>
            ))}
            <p>{CONSENT_FOOTNOTE}</p>
          </div>
        </details>
      </fieldset>

      <div aria-live="polite" style={{ display: "grid", gap: 8 }}>
        {error && <p className="error">{error}</p>}
        {status && <p className="status">{status}</p>}
      </div>

      <div>
        <button className="button" type="submit" disabled={busy}>{busy ? "Sending…" : "Send for free review"}</button>
      </div>
    </form>
  );
}
