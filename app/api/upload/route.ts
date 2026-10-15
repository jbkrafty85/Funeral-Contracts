import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { checkBotId } from "botid/server";
import { INTAKE_PATH } from "@/lib/blob";
import { allow, clientIp } from "@/lib/rate-limit";
import { ALLOWED_TYPES, MAX_TOTAL_BYTES } from "@/lib/site";

// Issues short-lived client tokens so the browser uploads straight to private Vercel Blob.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  if (body.type === "blob.generate-client-token") {
    if ((await checkBotId()).isBot) return Response.json({ error: "Access denied" }, { status: 403 });
    if (!(await allow(clientIp(request.headers), "upload", 40, 60))) {
      return Response.json({ error: "Too many uploads. Please try again in an hour." }, { status: 429 });
    }
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!INTAKE_PATH.test(pathname)) throw new Error("Invalid upload path");
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_TOTAL_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 });
  }
}
