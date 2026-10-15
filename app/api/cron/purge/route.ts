import { runPurge } from "@/lib/purge";

export const maxDuration = 300;

// Called daily by Vercel Cron (vercel.json). When CRON_SECRET is set, Vercel sends it as a
// bearer token and anything else is refused. Without it the job still only deletes data that
// is already past its scheduled deletion, so an extra call is harmless.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const counts = await runPurge();
    console.log("purge ok", JSON.stringify(counts));
    return Response.json({ ok: true, ...counts });
  } catch (err) {
    // Logged as an error so Vercel's log alerts (Phase 5) can catch a failing purge.
    console.error("PURGE FAILED:", err instanceof Error ? err.message : "unknown");
    return Response.json({ ok: false }, { status: 500 });
  }
}
