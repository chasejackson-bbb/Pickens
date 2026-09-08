import { handleRoute } from "@/lib/api-helpers";
import { syncScoresForWeek } from "@/lib/syncScores";
import { getWeekDetail } from "@/lib/queries";

/**
 * Pull current scores and auto-score this week's picks. Safe to call anytime, as many times as
 * you like, as games finish throughout the week -- not tied to any particular day. See
 * app/api/cron/sync-scores for the scheduled safety-net version of this.
 */
export async function POST(_req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    await syncScoresForWeek(params.weekId);
    return getWeekDetail(params.weekId);
  });
}
