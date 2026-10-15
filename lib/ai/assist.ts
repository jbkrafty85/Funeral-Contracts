import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { get } from "@vercel/blob";
import { ReviewDraft } from "@/lib/review";
import { KNOWLEDGE_BASE } from "./knowledge-base";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type FileRef = { blob_key: string; mime_type: string };
type ContentBlock = Anthropic.Beta.BetaContentBlockParam;

export type AssistResult =
  | { ok: true; draft: ReviewDraft; skipped: string[]; fallbackModel: string | null }
  | { ok: false; error: string };

async function readBlob(key: string) {
  const res = await get(key, { access: "private" });
  if (!res?.stream) throw new Error("file missing");
  return Buffer.from(await new Response(res.stream).arrayBuffer());
}

// Sends the contract to Claude with the knowledge base and gets back a filled-in review form.
// Reps only; the rep edits everything before it goes anywhere.
export async function runAssist(files: FileRef[], contractType: string): Promise<AssistResult> {
  const content: ContentBlock[] = [];
  const skipped: string[] = [];

  for (const [i, f] of files.entries()) {
    const n = `File ${i + 1}`;
    if (f.mime_type === "application/pdf") {
      const data = (await readBlob(f.blob_key)).toString("base64");
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    } else if ((IMAGE_TYPES as readonly string[]).includes(f.mime_type)) {
      const buf = await readBlob(f.blob_key);
      if (buf.length > MAX_IMAGE_BYTES) {
        skipped.push(`${n} (photo over 5 MB)`);
        continue;
      }
      content.push({
        type: "image",
        source: { type: "base64", media_type: f.mime_type as (typeof IMAGE_TYPES)[number], data: buf.toString("base64") },
      });
    } else {
      skipped.push(`${n} (${f.mime_type === "image/heic" || f.mime_type === "image/heif" ? "iPhone HEIC photo" : f.mime_type} can't be read by the AI)`);
    }
  }
  if (!content.length) return { ok: false, error: "None of the files can be read by the AI. Review them manually." };

  content.push({
    type: "text",
    text:
      `These ${content.length} file(s) are one contract, in page order. ` +
      `The family said the contract type is: ${contractType}. Review it and fill in the form.`,
  });

  const client = new Anthropic();
  try {
    const res = await client.beta.messages.parse(
      {
        model: "claude-opus-5-5",
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "high", format: betaZodOutputFormat(ReviewDraft) },
        system: [{ type: "text", text: KNOWLEDGE_BASE, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
      },
      { timeout: 280_000 },
    );

    if (res.stop_reason === "refusal") return { ok: false, error: "The AI declined to review this document. Review it manually." };
    if (res.stop_reason === "max_tokens") return { ok: false, error: "The AI ran out of room on this contract. Try again or review manually." };
    if (!res.parsed_output) return { ok: false, error: "The AI's answer couldn't be read. Try again." };

    const fellBack = (res.usage.iterations ?? []).some((it) => it.type === "fallback_message");
    return { ok: true, draft: res.parsed_output, skipped, fallbackModel: fellBack ? res.model : null };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: "The AI is busy. Try again in a minute." };
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "The AI key isn't set up (ANTHROPIC_API_KEY)." };
    if (err instanceof Anthropic.BadRequestError) {
      console.error("assist: bad request:", err.message);
      return { ok: false, error: "The AI couldn't process these files." };
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`assist: API error ${err.status}`);
      return { ok: false, error: "The AI service had an error. Try again." };
    }
    throw err;
  }
}
