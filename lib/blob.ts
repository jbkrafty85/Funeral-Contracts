import "server-only";
import { del, head } from "@vercel/blob";

// Uploads are named intake/<uuid>.<ext> by the browser — never the original filename,
// which often carries the family's name.
export const INTAKE_PATH = /^intake\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|heic|heif|webp)$/;

export type VerifiedBlob = { pathname: string; contentType: string; size: number };

// Confirms the blob exists and is NOT publicly readable. The client chooses access when it
// uploads, so a tampered browser could ask for "public"; if it did, the file is deleted and refused.
export async function verifyPrivateUpload(pathname: string): Promise<VerifiedBlob> {
  if (!INTAKE_PATH.test(pathname)) throw new Error("bad path");
  const meta = await head(pathname);
  const probe = await fetch(meta.url, { method: "HEAD", cache: "no-store" });
  if (probe.ok) {
    await del(pathname);
    throw new Error("upload was public");
  }
  return { pathname: meta.pathname, contentType: meta.contentType, size: meta.size };
}

export async function deleteBlobs(pathnames: string[]) {
  if (pathnames.length) await del(pathnames);
}
