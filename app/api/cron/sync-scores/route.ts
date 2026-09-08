import { NextResponse } from "next/server";
import { syncAllInProgressWeeks } from "@/lib/syncScores";

/**
 * Scheduled safety net: syncs scores for every week currently in_progress. Not the primary way
 * scores get pulled -- anyone can (and should) click "Sync scores" on a week's page anytime,
 * repeatedly, as games finish. This just catches the case where nobody got around to it.
 * Configured in vercel.json to fire at midnight PST (fixed UTC-8, not Pacific *Daylight* Time,
 * so the schedule doesn't shift when NFL season crosses the DST change in November) after
 * Thursday, Sunday, and Monday games.
 *
 * Vercel invokes cron jobs with GET and, when CRON_SECRET is set, an
 * `Authorization: Bearer <CRON_SECRET>` header -- see
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs. Requires
 * CRON_SECRET to be set in the environment; without it this refuses to run, including for
 * Vercel's own requests, rather than running unauthenticated.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set -- refusing to run." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllInProgressWeeks();
  return NextResponse.json({ ranAt: new Date().toISOString(), weeksChecked: results.length, results });
}
