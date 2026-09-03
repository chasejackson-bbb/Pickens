import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import { DEFAULT_TIEBREAKER_PLAYER, DEFAULT_TIEBREAKER_STAT } from "@/lib/constants";
import { getWeekDetail } from "@/lib/queries";

const guessSchema = z.object({
  playerId: z.string(),
  guessValue: z.number(),
});

/** Submit (or update) a blind guess. Never returned with its value until revealed. */
export async function POST(req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const { playerId, guessValue } = guessSchema.parse(await req.json());
    await prisma.tiebreakerConfig.upsert({
      where: { weekId: params.weekId },
      update: {},
      create: {
        weekId: params.weekId,
        playerName: DEFAULT_TIEBREAKER_PLAYER,
        statType: DEFAULT_TIEBREAKER_STAT,
      },
    });
    await prisma.tiebreakerGuess.upsert({
      where: { weekId_playerId: { weekId: params.weekId, playerId } },
      update: { guessValue },
      create: { weekId: params.weekId, playerId, guessValue },
    });
    return { ok: true };
  });
}

const configSchema = z.object({
  playerName: z.string().optional(),
  statType: z.string().optional(),
  actualValue: z.number().optional(),
});

/** Edit the tiebreaker target (e.g. swap Pickens out for bye/injury) or record the actual value. */
export async function PUT(req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const data = configSchema.parse(await req.json());
    await prisma.tiebreakerConfig.upsert({
      where: { weekId: params.weekId },
      update: data,
      create: {
        weekId: params.weekId,
        playerName: data.playerName ?? DEFAULT_TIEBREAKER_PLAYER,
        statType: data.statType ?? DEFAULT_TIEBREAKER_STAT,
        actualValue: data.actualValue,
      },
    });
    return getWeekDetail(params.weekId);
  });
}

const revealSchema = z.object({ reveal: z.boolean() });

/** Manually unhide (or re-hide) every guess for the week. Any player can do this. */
export async function PATCH(req: Request, { params }: { params: { weekId: string } }) {
  return handleRoute(async () => {
    const { reveal } = revealSchema.parse(await req.json());
    await prisma.tiebreakerGuess.updateMany({ where: { weekId: params.weekId }, data: { revealed: reveal } });
    return getWeekDetail(params.weekId);
  });
}
