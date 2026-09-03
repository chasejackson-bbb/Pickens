import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { scorePicksForGame } from "@/lib/scoring";

const schema = z.object({
  finalHomeScore: z.number().int(),
  finalAwayScore: z.number().int(),
});

/**
 * Manually correct a game's final score (data-source error) and re-score every non-overridden
 * pick tied to it. Marks the game so future automatic score syncs won't overwrite the fix.
 */
export async function POST(req: Request, { params }: { params: { gameId: string } }) {
  return handleRoute(async () => {
    const { finalHomeScore, finalAwayScore } = schema.parse(await req.json());
    const game = await prisma.game.update({
      where: { id: params.gameId },
      data: { finalHomeScore, finalAwayScore, status: "final", manualOverride: true },
    });

    const picks = await prisma.pick.findMany({ where: { gameId: game.id } });
    const results = scorePicksForGame(
      {
        id: game.id,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        finalHomeScore: game.finalHomeScore,
        finalAwayScore: game.finalAwayScore,
        status: game.status,
      },
      picks.map((p) => ({
        id: p.id,
        teamPicked: p.teamPicked,
        lockedSpread: p.lockedSpread,
        gameId: p.gameId,
        manualOverride: p.manualOverride,
      }))
    );
    for (const r of results) {
      if (!r) continue;
      await prisma.pick.update({ where: { id: r.pickId }, data: { result: r.result, points: r.points } });
    }

    return prisma.game.findUnique({ where: { id: game.id }, include: { picks: true } });
  });
}
