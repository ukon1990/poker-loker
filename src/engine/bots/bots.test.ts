import { describe, expect, it } from 'vitest';
import { decideBot } from '@/engine/bots/decide';
import { preflopPercentile } from '@/engine/bots/preflop';
import {
  type BotProfile,
  closestDifficulty,
  createBots,
  PERSONAS,
  targetSkill,
} from '@/engine/bots/profile';
import { recordTendencies, type TableTendencies } from '@/engine/bots/tendencies';
import { coachAdvice } from '@/engine/coach/coach';
import { cards } from '@/engine/core/cards';
import { applyAction, type HandState, startHand } from '@/engine/core/hand';
import { createRng, deriveSeed } from '@/engine/core/rng';
import { viewFor } from '@/engine/core/view';
import { estimateEquity } from '@/engine/equity/equity';
import { holdemNoLimit } from '@/engine/variants/holdem';
import { estimatePlayerSkill } from '@/learning/skill';

const STAKES = { smallBlind: 5, bigBlind: 10, ante: 0 };
const BALANCED = { looseness: 0.5, aggression: 0.5, bluff: 0.25 };

function bot(skill: number, style = BALANCED): BotProfile {
  return { personaId: 'test', name: 'Test', style, skill };
}

function start(seed: number, stacks: number[], buttonSeat = 0): HandState {
  return startHand({
    variantId: 'holdem-nl',
    seed,
    stakes: STAKES,
    buttonSeat,
    seats: stacks.map((stack, seat) => ({ seat, stack })),
  });
}

function withHole(state: HandState, seat: number, hole: string): HandState {
  return {
    ...state,
    players: state.players.map((p) => (p.seat === seat ? { ...p, hole: cards(hole) } : p)),
  };
}

function playOut(initial: HandState, bots: readonly BotProfile[], seed: number): HandState {
  let state = initial;
  let step = 0;
  while (state.toAct !== null) {
    const seat = state.toAct;
    const rng = createRng(deriveSeed(seed, step++));
    const action = decideBot(viewFor(state, seat), bots[seat], rng, { maxIterations: 50 });
    state = applyAction(state, action).state;
  }
  return state;
}

describe('equity', () => {
  it('matches well-known matchups', () => {
    const run = (hole: string, board: string, percentile = 1, opponents = 1) =>
      estimateEquity(
        holdemNoLimit,
        cards(hole),
        cards(board),
        Array.from({ length: opponents }, () => ({ maxPercentile: percentile })),
        20_000,
        createRng(5),
      );

    expect(run('As Ah', '')).toBeGreaterThan(0.83);
    expect(run('As Ah', '')).toBeLessThan(0.87);
    expect(run('7d 2c', '')).toBeLessThan(0.38);
    // A nut flush draw on the flop against one random hand.
    expect(run('Ad 7d', 'Ks 9d 3d')).toBeGreaterThan(0.5);
    expect(run('As Ah', '', 1, 4)).toBeLessThan(run('As Ah', '', 1, 1));
  });

  it('counts a board that plays for everyone as a tie', () => {
    const equity = estimateEquity(
      holdemNoLimit,
      cards('2c 3d'),
      cards('As Ks Qs Js Ts'),
      [{ maxPercentile: 1 }],
      500,
      createRng(1),
    );
    expect(equity).toBeCloseTo(0.5, 5);
  });

  it('gets worse against a tighter range', () => {
    const against = (maxPercentile: number) =>
      estimateEquity(holdemNoLimit, cards('Jc Td'), [], [{ maxPercentile }], 8000, createRng(2));
    expect(against(0.1)).toBeLessThan(against(1));
  });
});

describe('preflop ranking', () => {
  it('ranks the best hands near the top and the worst near the bottom', () => {
    const [ace, aceTwo] = cards('As Ah');
    const [seven, two] = cards('7d 2c');
    expect(preflopPercentile(ace, aceTwo)).toBeLessThan(0.02);
    expect(preflopPercentile(seven, two)).toBeGreaterThan(0.9);
  });

  it('prefers suited to unsuited', () => {
    const [a1, k1] = cards('As Ks');
    const [a2, k2] = cards('As Kd');
    expect(preflopPercentile(a1, k1)).toBeLessThan(preflopPercentile(a2, k2));
  });
});

describe('decideBot', () => {
  it('only ever picks legal actions, at every skill and style', () => {
    const rng = createRng(77);
    for (let i = 0; i < 300; i++) {
      const seats = 2 + rng.nextInt(8);
      const stacks = Array.from({ length: seats }, () => 5 + rng.nextInt(600));
      const bots = Array.from({ length: seats }, () =>
        bot(rng.nextFloat(), PERSONAS[rng.nextInt(PERSONAS.length)].style),
      );
      // applyAction throws on an illegal action.
      const state = playOut(start(rng.nextUint32(), stacks), bots, i);
      expect(state.result).not.toBeNull();
    }
  });

  it('is repeatable from the same seed', () => {
    const view = viewFor(start(3, [1000, 1000, 1000]), 0);
    expect(decideBot(view, bot(0.5), createRng(9))).toEqual(
      decideBot(view, bot(0.5), createRng(9)),
    );
  });

  it('varies its choice, so it is not predictable', () => {
    const view = viewFor(withHole(start(3, [1000, 1000, 1000]), 0, 'Tc 4d'), 0);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(decideBot(view, bot(0.4), createRng(i)).type);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('reacts to its actual cards', () => {
    const foldRate = (hole: string, skill: number) => {
      const view = viewFor(withHole(start(3, [1000, 1000, 1000, 1000, 1000, 1000]), 3, hole), 3);
      let folds = 0;
      for (let i = 0; i < 300; i++) {
        if (decideBot(view, bot(skill), createRng(i), { maxIterations: 120 }).type === 'fold')
          folds++;
      }
      return folds / 300;
    };

    expect(foldRate('As Ah', 0.9)).toBeLessThan(0.02);
    expect(foldRate('7d 2c', 0.9)).toBeGreaterThan(0.9);
  });

  it('makes more mistakes at low skill', () => {
    const foldRate = (hole: string, skill: number) => {
      const view = viewFor(withHole(start(3, [1000, 1000, 1000, 1000, 1000, 1000]), 3, hole), 3);
      let folds = 0;
      for (let i = 0; i < 300; i++) {
        if (decideBot(view, bot(skill), createRng(i), { maxIterations: 120 }).type === 'fold')
          folds++;
      }
      return folds / 300;
    };

    expect(foldRate('Qc 8d', 0.05)).toBeLessThan(foldRate('Qc 8d', 0.95));
  });

  it('lets looser styles play more hands', () => {
    const playRate = (looseness: number) => {
      const view = viewFor(withHole(start(3, [1000, 1000, 1000, 1000, 1000, 1000]), 3, 'Ad Jc'), 3);
      let played = 0;
      for (let i = 0; i < 400; i++) {
        const style = { ...BALANCED, looseness };
        if (decideBot(view, bot(0.5, style), createRng(i), { maxIterations: 120 }).type !== 'fold')
          played++;
      }
      return played;
    };
    expect(playRate(0.95)).toBeGreaterThan(playRate(0.05));
  });

  it('wins chips from a much weaker bot over many hands', () => {
    let strongNet = 0;
    for (let hand = 0; hand < 800; hand++) {
      // Each seat plays both sides of the button.
      const strongSeat = hand % 2;
      const bots = [bot(0.05), bot(0.05)];
      bots[strongSeat] = bot(0.95);
      const result = playOut(start(deriveSeed(11, hand), [1000, 1000], 0), bots, hand).result;
      strongNet += result?.net.find((entry) => entry.seat === strongSeat)?.amount ?? 0;
    }
    expect(strongNet).toBeGreaterThan(0);
  });

  it('bluffs more against a player seen folding often', () => {
    const state = withHole(
      {
        ...applyAction(applyAction(start(4, [1000, 1000]), { type: 'call' }).state, {
          type: 'check',
        }).state,
      },
      1,
      '7d 2c',
    );
    const view = viewFor(state, state.toAct ?? 0);
    const foldsOften: TableTendencies = {
      0: { hands: 50, faced: 50, folded: 48 },
      1: { hands: 50, faced: 50, folded: 48 },
    };
    const neverFolds: TableTendencies = {
      0: { hands: 50, faced: 50, folded: 0 },
      1: { hands: 50, faced: 50, folded: 0 },
    };

    const raises = (tendencies: TableTendencies) => {
      let count = 0;
      for (let i = 0; i < 300; i++) {
        const action = decideBot(view, bot(0.95), createRng(i), { tendencies, maxIterations: 80 });
        if (action.type === 'raise') count++;
      }
      return count;
    };
    expect(raises(foldsOften)).toBeGreaterThan(raises(neverFolds));
  });
});

describe('table behaviour', () => {
  function tableStats(skill: number, hands: number) {
    let voluntary = 0;
    let allIn = 0;
    let potChips = 0;
    const bots = Array.from({ length: 6 }, () => bot(skill));

    for (let hand = 0; hand < hands; hand++) {
      const state = playOut(
        start(deriveSeed(21, skill * 100, hand), [1000, 1000, 1000, 1000, 1000, 1000], hand % 6),
        bots,
        deriveSeed(hand, skill * 100),
      );
      voluntary += new Set(
        state.events.flatMap((event) =>
          event.type === 'action' &&
          event.street === 0 &&
          event.action !== 'fold' &&
          event.action !== 'check'
            ? [event.seat]
            : [],
        ),
      ).size;
      if (state.players.some((player) => player.status === 'all-in')) allIn++;
      potChips += state.players.reduce((sum, player) => sum + player.totalBet, 0);
    }

    return {
      playedPerSeat: voluntary / (hands * 6),
      allInRate: allIn / hands,
      averagePotInBlinds: potChips / hands / STAKES.bigBlind,
    };
  }

  // These guard against the bots drifting into constant raising wars.
  it('plays recognisable poker at every level', () => {
    for (const skill of [0.15, 0.55, 0.92]) {
      const stats = tableStats(skill, 250);
      expect(stats.allInRate, `all-in rate at ${skill}`).toBeLessThan(0.15);
      expect(stats.averagePotInBlinds, `pot at ${skill}`).toBeLessThan(80);
    }
  });

  it('plays fewer hands as skill rises', () => {
    expect(tableStats(0.92, 250).playedPerSeat).toBeLessThan(tableStats(0.15, 250).playedPerSeat);
  });

  it('wins chips at a table of much weaker bots', () => {
    let net = 0;
    for (let hand = 0; hand < 1500; hand++) {
      const seat = hand % 6;
      const bots = Array.from({ length: 6 }, () => bot(0.15));
      bots[seat] = bot(0.92);
      const state = playOut(
        start(deriveSeed(31, hand), [1000, 1000, 1000, 1000, 1000, 1000], (hand * 5) % 6),
        bots,
        deriveSeed(hand, 77),
      );
      net += state.result?.net.find((entry) => entry.seat === seat)?.amount ?? 0;
    }
    expect(net).toBeGreaterThan(0);
  });
});

describe('fairness', () => {
  it('deals exactly the same cards whatever the difficulty', () => {
    const deal = (skill: number) => {
      const bots = createBots(5, skill, createRng(1));
      expect(bots).toHaveLength(5);
      return start(42, [1000, 1000, 1000, 1000, 1000, 1000]).players.map((p) => p.hole);
    };
    expect(deal(0.1)).toEqual(deal(0.9));
  });

  it('gives a bot nothing about other players cards', () => {
    const view = viewFor(start(8, [1000, 1000, 1000]), 0);
    const known = view.players.filter((player) => player.hole !== null);
    expect(known.map((player) => player.seat)).toEqual([0]);
  });
});

describe('difficulty', () => {
  it('sets each bot skill near the target, before the match', () => {
    const bots = createBots(8, 0.5, createRng(3));
    expect(new Set(bots.map((b) => b.personaId)).size).toBe(8);
    for (const profile of bots) {
      expect(profile.skill).toBeGreaterThanOrEqual(0.42);
      expect(profile.skill).toBeLessThanOrEqual(0.58);
    }
    expect(new Set(bots.map((b) => b.skill)).size).toBeGreaterThan(1);
  });

  it('follows the player on auto, with a slight stretch', () => {
    expect(targetSkill('auto', 0.5)).toBeCloseTo(0.55);
    expect(targetSkill('auto', 0)).toBeCloseTo(0.1);
    expect(targetSkill('auto', 1)).toBeCloseTo(0.95);
  });

  it('uses the preset when one is chosen, whatever the player skill', () => {
    expect(targetSkill('expert', 0)).toBeCloseTo(0.92);
    expect(targetSkill('beginner', 1)).toBeCloseTo(0.15);
  });

  it('names the nearest level', () => {
    expect(closestDifficulty(0.1).id).toBe('beginner');
    expect(closestDifficulty(0.6).id).toBe('regular');
  });
});

describe('player skill estimate', () => {
  const none = { total: 0, agreed: 0 };

  it('starts at zero', () => {
    expect(
      estimatePlayerSkill({
        lessonsCompleted: 0,
        lessonsTotal: 40,
        averageMastery: 0,
        decisions: none,
      }),
    ).toBe(0);
  });

  it('grows with lessons and mastery', () => {
    const low = estimatePlayerSkill({
      lessonsCompleted: 5,
      lessonsTotal: 40,
      averageMastery: 0.2,
      decisions: none,
    });
    const high = estimatePlayerSkill({
      lessonsCompleted: 30,
      lessonsTotal: 40,
      averageMastery: 0.8,
      decisions: none,
    });
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
  });

  it('ignores a handful of decisions', () => {
    const base = { lessonsCompleted: 10, lessonsTotal: 40, averageMastery: 0.5 };
    expect(estimatePlayerSkill({ ...base, decisions: { total: 5, agreed: 5 } })).toBe(
      estimatePlayerSkill({ ...base, decisions: none }),
    );
  });

  it('counts real decisions more as they add up', () => {
    const base = { lessonsCompleted: 0, lessonsTotal: 40, averageMastery: 0 };
    const some = estimatePlayerSkill({ ...base, decisions: { total: 40, agreed: 36 } });
    const many = estimatePlayerSkill({ ...base, decisions: { total: 400, agreed: 360 } });
    expect(many).toBeGreaterThan(some);
  });
});

describe('recordTendencies', () => {
  it('counts folds and bets faced from public actions', () => {
    const state = applyAction(start(1, [1000, 1000, 1000]), { type: 'fold' }).state;
    const tendencies = recordTendencies({}, [0, 1, 2], state.events);
    expect(tendencies[0]).toEqual({ hands: 1, faced: 1, folded: 1 });
    expect(tendencies[1]).toEqual({ hands: 1, faced: 0, folded: 0 });
  });
});

describe('coach', () => {
  function flushDrawSpot(): HandState {
    // Heads-up on the flop, facing a pot-sized bet with the nut flush draw.
    let state = start(1, [1000, 1000], 0);
    state = applyAction(state, { type: 'raise', to: 30 }).state;
    state = applyAction(state, { type: 'call' }).state;
    state = {
      ...state,
      board: cards('Ks 9d 3d'),
      players: state.players.map((p) => (p.seat === 0 ? { ...p, hole: cards('Ad 7d') } : p)),
    };
    return applyAction(state, { type: 'raise', to: 40 }).state;
  }

  it('works out the price and explains a flush draw', () => {
    const advice = coachAdvice(viewFor(flushDrawSpot(), 0), createRng(1), 2000);
    expect(advice.toCall).toBe(40);
    expect(advice.toWin).toBe(100);
    expect(advice.needed).toBeCloseTo(40 / 140, 5);
    expect(advice.equity).toBeGreaterThan(advice.needed ?? 1);
    expect(advice.text).toContain('Nine diamonds complete your {flush}.');
    expect(['call', 'raise']).toContain(advice.recommendation);
  });

  it('recommends folding a hopeless hand facing a big bet', () => {
    let state = start(1, [1000, 1000], 0);
    state = applyAction(state, { type: 'call' }).state;
    state = applyAction(state, { type: 'check' }).state;
    state = {
      ...state,
      board: cards('As Ks Qd'),
      players: state.players.map((p) => (p.seat === 0 ? { ...p, hole: cards('7c 2d') } : p)),
    };
    state = applyAction(state, { type: 'raise', to: 200 }).state;

    expect(coachAdvice(viewFor(state, 0), createRng(1), 1500).recommendation).toBe('fold');
  });

  it('has nothing to price when checking is free', () => {
    const state = applyAction(start(1, [1000, 1000], 0), { type: 'call' }).state;
    const advice = coachAdvice(viewFor(state, 1), createRng(1), 500);
    expect(advice.needed).toBeNull();
    expect(advice.toCall).toBe(0);
  });
});
