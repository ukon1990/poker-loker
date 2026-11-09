import { describe, expect, it, vi } from 'vitest';
import type { HandRecord, PlaySession } from '@/db/schema';
import type { CoachAdvice } from '@/engine/coach/coach';
import type { Action } from '@/engine/core/hand';
import type { HandView } from '@/engine/core/view';
import { TableController } from '@/features/table/controller';
import type { TableEngine } from '@/features/table/engine-client';
import { createPlaySession, HERO_SEAT } from '@/features/table/session';

function setup(coachVisible = true) {
  const session = createPlaySession({ seatCount: 3, difficulty: 'auto', playerSkill: 0.3 });
  const records: HandRecord[] = [];
  const saved: PlaySession[] = [];
  const engine: TableEngine = {
    decide: vi.fn(
      async (view: HandView): Promise<Action> =>
        view.legal?.check ? { type: 'check' } : { type: 'fold' },
    ),
    coach: vi.fn(
      async (): Promise<CoachAdvice> => ({
        toCall: 0,
        toWin: 0,
        needed: null,
        equity: 0.5,
        recommendation: 'fold',
        text: 'Advice',
      }),
    ),
  };
  const controller = new TableController(session, {
    engine,
    save: async (next) => {
      saved.push(next);
    },
    recordHand: async (record) => {
      records.push(record);
    },
    isCoachVisible: () => coachVisible,
    pause: async () => {},
  });
  return { session, controller, engine, records, saved };
}

async function settle() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function playUntilHandOver(controller: TableController) {
  for (let i = 0; i < 30; i++) {
    await settle();
    const hand = controller.store.get().table.hand;
    if (hand?.result) return;
    if (hand?.toAct === HERO_SEAT) {
      controller.act(
        hand.players.find((p) => p.seat === HERO_SEAT)?.streetBet === hand.currentBet
          ? { type: 'check' }
          : { type: 'fold' },
      );
    }
  }
}

describe('createPlaySession', () => {
  it('sets every bot before the match', () => {
    const session = createPlaySession({ seatCount: 6, difficulty: 'expert', playerSkill: 0 });
    expect(session.config.bots).toHaveLength(5);
    for (const bot of session.config.bots) expect(bot.skill).toBeGreaterThan(0.8);
  });

  it('follows the player on auto', () => {
    const low = createPlaySession({ seatCount: 3, difficulty: 'auto', playerSkill: 0.1 });
    const high = createPlaySession({ seatCount: 3, difficulty: 'auto', playerSkill: 0.8 });
    expect(high.config.targetSkill).toBeGreaterThan(low.config.targetSkill);
  });
});

describe('TableController', () => {
  it('plays a hand through and records it once', async () => {
    const { controller, records } = setup();
    controller.start();
    await playUntilHandOver(controller);
    await settle();

    expect(controller.store.get().table.hand?.result).not.toBeNull();
    expect(records).toHaveLength(1);
    expect(records[0].handNumber).toBe(1);
    controller.dispose();
  });

  it('keeps all chips in play across hands', async () => {
    const { controller } = setup();
    controller.start();
    for (let hand = 0; hand < 5; hand++) {
      await playUntilHandOver(controller);
      await settle();
      controller.nextHand();
    }
    await playUntilHandOver(controller);
    const { table } = controller.store.get();
    const inHand = table.hand?.players.reduce((sum, player) => sum + player.stack, 0) ?? 0;
    const sitting = table.seats.filter(
      (seat) => !table.hand?.players.some((p) => p.seat === seat.seat),
    );
    expect(inHand + sitting.reduce((sum, seat) => sum + seat.stack, 0)).toBe(3000);
    controller.dispose();
  });

  it('only counts decisions made without the coach', async () => {
    const coached = setup(true);
    coached.controller.start();
    await playUntilHandOver(coached.controller);
    await settle();
    expect(coached.records[0].decisions.total).toBe(0);
    coached.controller.dispose();
  });

  it('carries on from a saved game without re-dealing', async () => {
    const first = setup();
    first.controller.start();
    await settle();
    const dealt = first.controller.store.get().table;
    first.controller.dispose();

    const resumed = new TableController(
      { ...first.session, engineState: { table: dealt, tendencies: {} } },
      {
        engine: first.engine,
        save: async () => {},
        recordHand: async () => {},
        isCoachVisible: () => true,
        pause: async () => {},
      },
    );
    resumed.start();
    await settle();
    expect(resumed.store.get().table.handNumber).toBe(dealt.handNumber);
    expect(resumed.store.get().table.hand?.seed).toBe(dealt.hand?.seed);
    resumed.dispose();
  });
});
