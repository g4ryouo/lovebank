import { prepare } from "@/lib/api/route-helpers";
import { json } from "@/lib/api/guard";
import { createProposalHandler } from "@/lib/proposals/handlers";

export async function POST(request: Request) {
  const ready = await prepare(request);
  if (!ready.ok) return ready.response;
  const result = await createProposalHandler(ready.userId, ready.body, ready.deps);
  return json(result.status, result.body);
}
