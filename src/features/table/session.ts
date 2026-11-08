import type { PlaySession } from '@/db/schema';
import { createBots, type DifficultyId, targetSkill } from '@/engine/bots/profile';
import { createRng } from '@/engine/core/rng';
import { createTable } from '@/engine/core/table';
import { randomSeed } from '@/learning/seed';

export const STAKES = { smallBlind: 5, bigBlind: 10, ante: 0 };
export const STARTING_STACK = 1000;
export const HERO_SEAT = 0;

/** Sets up a table. Each bot's skill is decided here, before any cards are dealt. */
export function createPlaySession(input: {
  seatCount: number;
  difficulty: DifficultyId;
  playerSkill: number;
  now?: Date;
}): PlaySession {
  const { seatCount, difficulty, playerSkill } = input;
  const now = (input.now ?? new Date()).getTime();
  const seed = randomSeed();
  const target = targetSkill(difficulty, playerSkill);

  return {
    id: `${now.toString(36)}-${seed.toString(36)}`,
    variantId: 'holdem-nl',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    handsPlayed: 0,
    config: {
      seatCount,
      difficulty,
      targetSkill: target,
      bots: createBots(seatCount - 1, target, createRng(seed)),
    },
    engineState: {
      table: createTable({
        variantId: 'holdem-nl',
        stakes: STAKES,
        startingStack: STARTING_STACK,
        baseSeed: seed,
        seatCount,
      }),
      tendencies: {},
    },
  };
}

export function seatNames(session: PlaySession): Record<number, string> {
  const names: Record<number, string> = { [HERO_SEAT]: 'You' };
  session.config.bots.forEach((bot, index) => {
    names[index + 1] = bot.name;
  });
  return names;
}
