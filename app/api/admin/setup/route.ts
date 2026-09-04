import { handleRoute, jsonError } from "@/lib/api-helpers";
import { seedDatabase, importLegacyHistory } from "@/lib/setup";

/**
 * One-time (but safe to re-run) production setup: seeds players/team-aliases/payout config,
 * then runs the historical import. Exists because some environments that manage this
 * deployment (e.g. a sandboxed agent) can reach the deployed app over HTTPS but not the
 * database directly -- this lets setup happen through the app itself, which always has a
 * normal connection to its own database.
 *
 * Protected by a shared secret (ADMIN_SETUP_TOKEN) rather than left open, since re-running it
 * is harmless but there's no reason to expose a database-writing endpoint publicly.
 *
 * Two ways to call it:
 *  - POST with an `x-setup-token` header (scriptable, e.g. curl).
 *  - GET with a `?token=` query param (so it can be triggered by just opening a URL in a
 *    browser -- useful when nothing scriptable can reach the deployment).
 */
async function run() {
  return handleRoute(async () => {
    const seedLog = await seedDatabase();
    const importResult = await importLegacyHistory();
    return { seedLog, importResult };
  });
}

function checkToken(provided: string | null) {
  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected) {
    return jsonError("ADMIN_SETUP_TOKEN is not set in this environment -- refusing to run.", 500);
  }
  if (provided !== expected) {
    return jsonError("Unauthorized", 401);
  }
  return null;
}

export async function POST(req: Request) {
  const denied = checkToken(req.headers.get("x-setup-token"));
  if (denied) return denied;
  return run();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const denied = checkToken(searchParams.get("token"));
  if (denied) return denied;
  return run();
}
