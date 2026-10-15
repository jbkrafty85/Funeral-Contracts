import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "./db";

// Fixed-window per-IP limit backed by Postgres. The IP is HMAC'd with a server secret
// so the table never holds a raw address.
export async function allow(ip: string, bucket: string, limit: number, windowMinutes: number) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret) throw new Error("RATE_LIMIT_SECRET is not set");
  const key = bucket + ":" + createHmac("sha256", secret).update(ip).digest("base64url");
  const windowMs = windowMinutes * 60_000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const rows = (await sql()`
    INSERT INTO rate_limits (key, window_start, hits) VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
    RETURNING hits
  `) as { hits: number }[];
  return rows[0].hits <= limit;
}

export function clientIp(headers: Headers) {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
