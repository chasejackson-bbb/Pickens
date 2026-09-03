import { handleRoute, jsonError } from "@/lib/api-helpers";
import { getWeekDetail, getWeekResult } from "@/lib/queries";

export async function GET(_req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const result = await getWeekResult(params.weekId);
    if (!result) throw new Error("Week not found");
    return result;
  });
}
