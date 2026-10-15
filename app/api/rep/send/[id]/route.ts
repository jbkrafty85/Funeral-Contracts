import { currentRep } from "@/lib/rep";
import { performSend } from "@/lib/send";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rep = await currentRep();
  if (!rep) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await performSend(rep, id, await request.json().catch(() => null), request.url);
  if (!result.ok) return Response.json({ error: result.error, pii: result.pii }, { status: result.status });
  return Response.json(result);
}
