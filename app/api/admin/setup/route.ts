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
 * is harmless but there's no reason to expose a database-writing endpoint publicly. Set
 * ADMIN_SETUP_TOKEN in your environment and pass it as the `x-setup-token` header.
 */
export async function POST(req: Request) {
  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected) {
    return jsonError("ADMIN_SETUP_TOKEN is not set in this environment -- refusing to run.", 500);
  }
  const provided = req.headers.get("x-setup-token");
  if (provided !== expected) {
    return jsonError("Unauthorized", 401);
  }

  return handleRoute(async () => {
    const seedLog = await seedDatabase();
    const importResult = await importLegacyHistory();
    return { seedLog, importResult };
  });
}
