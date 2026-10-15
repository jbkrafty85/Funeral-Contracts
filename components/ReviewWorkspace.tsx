"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { scanPii, type PiiFinding } from "@/lib/pii";
import {
  emptyPreneed,
  LABELS,
  LINE_CATEGORIES,
  PROVIDER_TYPES,
  REVIEW_CONTRACT_TYPES,
  SERVICE_TYPES,
  sendBlockers,
  trainingText,
  type LineItem,
  type ReviewDraft,
} from "@/lib/review";
import { formatTime } from "@/lib/site";

type FileInfo = { id: string; mime_type: string; bytes: number };

type Props = {
  submissionId: string;
  receivedAt: string;
  familyContractType: string;
  files: FileInfo[];
  initialDraft: ReviewDraft;
  draftSavedAt: string | null;
  releaseAction: (fd: FormData) => Promise<void>;
};

const money = (n: number | null) => (n == null ? "" : String(n));
const parseMoney = (v: string) => {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
};

export default function ReviewWorkspace(p: Props) {
  const [d, setD] = useState<ReviewDraft>(p.initialDraft);
  const [fileIdx, setFileIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(p.draftSavedAt);
  const [busy, setBusy] = useState<"" | "save" | "assist" | "send">("");
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "warn"; text: string } | null>(null);
  const [assistNotes, setAssistNotes] = useState<string[]>([]);
  const [noPii, setNoPii] = useState(false);
  const [flagsText, setFlagsText] = useState(p.initialDraft.red_flags.join("\n"));

  function update(patch: Partial<ReviewDraft>) {
    setD((cur) => ({ ...cur, ...patch }));
    setDirty(true);
    setNoPii(false);
  }
  function updateItem(i: number, patch: Partial<LineItem>) {
    update({ line_items: d.line_items.map((li, j) => (j === i ? { ...li, ...patch } : li)) });
  }

  const pii: PiiFinding[] = useMemo(() => scanPii(trainingText(d)), [d]);
  const blockers = sendBlockers(d);
  const itemsTotal = d.line_items.reduce((n, li) => n + (li.price ?? 0), 0);
  const canSend = blockers.length === 0 && pii.length === 0 && noPii;

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch(`/api/rep/review/${p.submissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      setSavedAt(body.savedAt);
      setDirty(false);
      setMsg({ kind: "ok", text: "Draft saved." });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setBusy("");
    }
  }

  async function assist() {
    if ((d.line_items.length || d.advice.trim()) && !confirm("Replace the current form with the AI's draft?")) return;
    setBusy("assist");
    setMsg(null);
    setAssistNotes([]);
    try {
      const res = await fetch(`/api/rep/assist/${p.submissionId}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "AI assist failed");
      setD(body.draft);
      setFlagsText(body.draft.red_flags.join("\n"));
      setDirty(true);
      setNoPii(false);
      const notes: string[] = [];
      if (body.skipped?.length) notes.push(`Not sent to the AI: ${body.skipped.join(", ")}. Check those yourself.`);
      if (body.fallbackModel) notes.push(`Answered by a fallback model (${body.fallbackModel}).`);
      if (body.piiWarnings?.length) notes.push("The AI draft may contain personal details — see the warnings under the advice.");
      setAssistNotes(notes);
      setMsg({ kind: "ok", text: "AI draft filled in. Check every field against the contract before saving." });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "AI assist failed" });
    } finally {
      setBusy("");
    }
  }

  async function send() {
    if (!confirm("Send this review to the family now? The uploaded contract will be deleted and the training record saved. This can't be undone.")) return;
    setBusy("send");
    setMsg(null);
    try {
      const res = await fetch(`/api/rep/send/${p.submissionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: d, confirmNoPii: noPii }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Send failed");
      setDirty(false);
      router.push(`/rep?status=sent&sent=${body.delivered ? "delivered" : "undelivered"}`);
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Send failed" });
      setBusy("");
    }
  }

  const file = p.files[fileIdx];
  const fileUrl = file ? `/api/rep/file/${file.id}` : "";

  return (
    <div className="workspace">
      {/* ── Contract viewer ── */}
      <section className="viewer" aria-label="Contract">
        <div className="viewer-bar">
          {p.files.map((f, i) => (
            <button key={f.id} className={"tab" + (i === fileIdx ? " active" : "")} onClick={() => setFileIdx(i)} type="button">
              File {i + 1}
            </button>
          ))}
          <span className="spacer" />
          {file && <a href={fileUrl} target="_blank" rel="noreferrer" className="note">Open in new tab</a>}
        </div>
        {file &&
          (file.mime_type === "application/pdf" ? (
            <iframe key={file.id} src={fileUrl} title={`Contract file ${fileIdx + 1}`} className="viewer-frame" />
          ) : file.mime_type === "image/heic" || file.mime_type === "image/heif" ? (
            <div className="viewer-empty">
              <p>iPhone HEIC photos can&apos;t be shown in the browser.</p>
              <a className="button small secondary" href={fileUrl}>Download to view</a>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={file.id} src={fileUrl} alt={`Contract page ${fileIdx + 1}`} className="viewer-img" />
          ))}
      </section>

      {/* ── Structured review form ── */}
      <section className="review-form" aria-label="Review">
        <div className="review-head">
          <div>
            <h1>Review</h1>
            <p className="note">
              Received {formatTime(p.receivedAt)} · family chose{" "}
              {p.familyContractType === "not_sure" ? "Not sure" : LABELS[p.familyContractType]}
            </p>
          </div>
          <button className="button" type="button" onClick={assist} disabled={busy !== ""}>
            {busy === "assist" ? "AI is reading…" : "AI assist"}
          </button>
        </div>
        {busy === "assist" && <p className="note">This usually takes 30–90 seconds.</p>}
        {msg && <p className={msg.kind === "error" ? "error" : "status"}>{msg.text}</p>}
        {assistNotes.map((n) => <p key={n} className="warn">{n}</p>)}

        <fieldset className="group">
          <legend>Seller</legend>
          <div className="grid2">
            <label>Name<input value={d.provider.name} onChange={(e) => update({ provider: { ...d.provider, name: e.target.value } })} /></label>
            <label>Type
              <select value={d.provider.type} onChange={(e) => update({ provider: { ...d.provider, type: e.target.value as ReviewDraft["provider"]["type"] } })}>
                {PROVIDER_TYPES.map((t) => <option key={t} value={t}>{LABELS[t]}</option>)}
              </select>
            </label>
            <label>City<input value={d.provider.city ?? ""} onChange={(e) => update({ provider: { ...d.provider, city: e.target.value || null } })} /></label>
            <label>State<input value={d.provider.state ?? ""} maxLength={2} placeholder="PA" onChange={(e) => update({ provider: { ...d.provider, state: e.target.value.toUpperCase() || null } })} /></label>
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Contract</legend>
          <div className="grid3">
            <label>Type
              <select
                value={d.contract_type}
                onChange={(e) => {
                  const t = e.target.value as ReviewDraft["contract_type"];
                  update({ contract_type: t, preneed: t === "preneed" ? d.preneed ?? emptyPreneed() : null });
                }}
              >
                {REVIEW_CONTRACT_TYPES.map((t) => <option key={t} value={t}>{LABELS[t]}</option>)}
              </select>
            </label>
            <label>Service
              <select value={d.service_type} onChange={(e) => update({ service_type: e.target.value as ReviewDraft["service_type"] })}>
                {SERVICE_TYPES.map((t) => <option key={t} value={t}>{LABELS[t]}</option>)}
              </select>
            </label>
            <label>Month signed<input type="month" value={d.contract_month ?? ""} onChange={(e) => update({ contract_month: e.target.value || null })} /></label>
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Line items</legend>
          <table className="items">
            <thead>
              <tr><th>Category</th><th>Description</th><th>Price</th><th>Flag</th><th /></tr>
            </thead>
            <tbody>
              {d.line_items.map((li, i) => (
                <tr key={i} className={li.flagged ? "flagged" : ""}>
                  <td>
                    <select value={li.category} onChange={(e) => updateItem(i, { category: e.target.value as LineItem["category"] })} aria-label="Category">
                      {LINE_CATEGORIES.map((c) => <option key={c} value={c}>{LABELS[c]}</option>)}
                    </select>
                  </td>
                  <td>
                    <input value={li.description} onChange={(e) => updateItem(i, { description: e.target.value })} aria-label="Description" />
                    {li.flagged && (
                      <input className="flag-reason" placeholder="Why it's flagged" value={li.flag_reason ?? ""} onChange={(e) => updateItem(i, { flag_reason: e.target.value || null })} aria-label="Flag reason" />
                    )}
                  </td>
                  <td><input className="price" inputMode="decimal" value={money(li.price)} onChange={(e) => updateItem(i, { price: parseMoney(e.target.value) })} aria-label="Price" /></td>
                  <td><input type="checkbox" checked={li.flagged} onChange={(e) => updateItem(i, { flagged: e.target.checked })} aria-label="Flagged" /></td>
                  <td><button type="button" className="linklike" onClick={() => update({ line_items: d.line_items.filter((_, j) => j !== i) })}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="button small secondary"
            onClick={() => update({ line_items: [...d.line_items, { category: "other", description: "", price: null, flagged: false, flag_reason: null }] })}
          >
            Add line item
          </button>
          <div className="grid3" style={{ marginTop: 14 }}>
            <label>Contract total<input inputMode="decimal" value={money(d.contract_total)} onChange={(e) => update({ contract_total: parseMoney(e.target.value) })} /></label>
            <label>Estimated savings<input inputMode="decimal" value={money(d.est_savings)} onChange={(e) => update({ est_savings: parseMoney(e.target.value) })} /></label>
            <div className="note" style={{ alignSelf: "end" }}>
              Items add up to ${itemsTotal.toLocaleString()}
              {d.contract_total != null && Math.abs(itemsTotal - d.contract_total) > 1 && " — differs from total"}
            </div>
          </div>
        </fieldset>

        {d.preneed && (
          <fieldset className="group">
            <legend>Preneed terms</legend>
            <div className="grid3">
              <label>Funding
                <select value={d.preneed.funding} onChange={(e) => update({ preneed: { ...d.preneed!, funding: e.target.value as "trust" } })}>
                  {["trust", "insurance", "installment", "unknown"].map((v) => <option key={v} value={v}>{LABELS[v]}</option>)}
                </select>
              </label>
              <label>Price guaranteed
                <select value={d.preneed.price_guaranteed} onChange={(e) => update({ preneed: { ...d.preneed!, price_guaranteed: e.target.value as "yes" } })}>
                  {["yes", "partial", "no", "unknown"].map((v) => <option key={v} value={v}>{LABELS[v]}</option>)}
                </select>
              </label>
              <label>Transferable
                <select
                  value={d.preneed.transferable == null ? "" : d.preneed.transferable ? "yes" : "no"}
                  onChange={(e) => update({ preneed: { ...d.preneed!, transferable: e.target.value === "" ? null : e.target.value === "yes" } })}
                >
                  <option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
                </select>
              </label>
              <label>Refund on cancel (%)<input inputMode="decimal" value={money(d.preneed.cancellation_refund_pct)} onChange={(e) => update({ preneed: { ...d.preneed!, cancellation_refund_pct: parseMoney(e.target.value) } })} /></label>
              <label>Finance charges ($)<input inputMode="decimal" value={money(d.preneed.finance_charges)} onChange={(e) => update({ preneed: { ...d.preneed!, finance_charges: parseMoney(e.target.value) } })} /></label>
              <label>State<input maxLength={2} value={d.preneed.state ?? ""} onChange={(e) => update({ preneed: { ...d.preneed!, state: e.target.value.toUpperCase() || null } })} /></label>
            </div>
          </fieldset>
        )}

        <fieldset className="group">
          <legend>Red flags</legend>
          <textarea
            rows={3}
            value={flagsText}
            placeholder="One per line"
            onChange={(e) => {
              setFlagsText(e.target.value);
              update({ red_flags: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) });
            }}
          />
          <label className="check"><input type="checkbox" checked={d.ftc_issue} onChange={(e) => update({ ftc_issue: e.target.checked })} /> Possible FTC Funeral Rule issue</label>
        </fieldset>

        <fieldset className="group">
          <legend>Advice to the family</legend>
          <p className="note">This is what the family reads, and it&apos;s kept for training. Write &quot;you&quot; — never their names.</p>
          <textarea rows={16} value={d.advice} onChange={(e) => update({ advice: e.target.value })} />
          {pii.length > 0 && (
            <div className="pii">
              <strong>Possible personal details in the review — remove before sending:</strong>
              <ul>{pii.map((f, i) => <li key={i}>{f.kind}: “{f.match}”</li>)}</ul>
            </div>
          )}
        </fieldset>

        <div className="send-box">
          <label className="check">
            <input type="checkbox" checked={noPii} onChange={(e) => setNoPii(e.target.checked)} />
            No family names or personal details in this advice.
          </label>
          {blockers.length > 0 && <ul className="note">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
          <div className="actions">
            <button className="button secondary" type="button" onClick={save} disabled={busy !== "" || !dirty}>
              {busy === "save" ? "Saving…" : dirty ? "Save draft" : "Saved"}
            </button>
            <button className="button" type="button" onClick={send} disabled={busy !== "" || !canSend}>
              {busy === "send" ? "Sending…" : "Send to family"}
            </button>
            <span className="spacer" />
            <form action={p.releaseAction}>
              <input type="hidden" name="id" value={p.submissionId} />
              <button className="linklike" type="submit">Return to queue</button>
            </form>
          </div>
          {savedAt && <p className="note">Last saved {formatTime(savedAt)}</p>}
        </div>
      </section>
    </div>
  );
}
