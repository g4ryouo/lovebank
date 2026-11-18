import { prepare } from "@/lib/api/route-helpers";
import { json } from "@/lib/api/guard";
import { counterProposalHandler } from "@/lib/proposals/handlers";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const ready = await prepare(request);
  if (!ready.ok) return ready.response;
  const { id } = await ctx.params;
  const result = await counterProposalHandler(ready.userId, id, ready.body, ready.deps);
  return json(result.status, result.body);
}
