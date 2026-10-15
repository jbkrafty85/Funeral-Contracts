import { auth } from "@/auth";

// Optimistic gate only: every /rep page and /api/rep route also checks the reps table itself.
export const proxy = auth((req) => {
  if (req.auth) return;
  if (req.nextUrl.pathname.startsWith("/api/")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.redirect(new URL("/rep/signin", req.nextUrl));
});

export const config = { matcher: ["/rep", "/rep/((?!signin).*)", "/api/rep/:path*"] };
