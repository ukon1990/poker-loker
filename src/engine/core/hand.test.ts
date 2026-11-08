import { describe, expect, it } from 'vitest';
import { cards } from '@/engine/core/cards';
import {
  type Action,
  applyAction,
  computePots,
  type HandState,
  legalActions,
  type Stakes,
  startHand,
} from '@/engine/core/hand';
import { createRng } from '@/engine/core/rng';
import { createTable, dealNextHand, positionNames, rebuy, settleHand } from '@/engine/core/table';
import { viewFor } from '@/engine/core/view';

const STAKES: Stakes = { smallBlind: 5, bigBlind: 10, ante: 0 };

function start(stacks: number[], buttonSeat = 0, seed = 1): HandState {
  return startHand({
    variantId: 'holdem-nl',
    seed,
    stakes: STAKES,
    buttonSeat,
    seats: stacks.map((stack, seat) => ({ seat, stack })),
  });
}

function play(state: HandState, ...actions: Action[]): HandState {
  return actions.reduce((current, action) => applyAction(current, action).state, state);
}

const FOLD: Action = { type: 'fold' };
const CHECK: Action = { type: 'check' };
const CALL: Action = { type: 'call' };
const raiseTo = (to: number): Action => ({ type: 'raise', to });

function stackOf(state: HandState, seat: number): number {
  return state.players.find((player) => player.seat === seat)?.stack ?? -1;
}

function totalChips(state: HandState): number {
  return state.players.reduce((sum, player) => sum + player.stack + player.totalBet, 0);
}

/** Replaces the dealt cards. The deck deals from its end. */
function rig(state: HandState, holes: string[], board: string): HandState {
  return {
    ...state,
    players: state.players.map((player, index) => ({ ...player, hole: cards(holes[index]) })),
    deck: cards(board).reverse(),
  };
}

describe('blinds and first action', () => {
  it('posts blinds left of the button, and the next player acts first', () => {
    const state = start([100, 100, 100, 100]);
    expect(state.players.map((player) => player.streetBet)).toEqual([0, 5, 10, 0]);
    expect(state.toAct).toBe(3);
  });

  it('heads-up, the button posts the small blind and acts first before the flop', () => {
    const state = start([100, 100], 1);
    expect(state.players.map((player) => player.streetBet)).toEqual([10, 5]);
    expect(state.toAct).toBe(1);
  });

  it('heads-up, the button acts last after the flop', () => {
    const state = play(start([100, 100], 1), CALL, CHECK);
    expect(state.street).toBe(1);
    expect(state.toAct).toBe(0);
  });

  it('gives the big blind the option to raise after limps', () => {
    const state = play(start([100, 100, 100]), CALL, CALL);
    expect(state.toAct).toBe(2);
    expect(legalActions(state)).toMatchObject({ check: true, raise: { min: 20 } });
  });

  it('deals two different cards to each player', () => {
    const state = start([100, 100, 100]);
    const dealt = state.players.flatMap((player) => player.hole);
    expect(dealt).toHaveLength(6);
    expect(new Set(dealt).size).toBe(6);
  });
});

describe('betting rules', () => {
  it('sets the minimum raise from the size of the last raise', () => {
    const state = play(start([1000, 1000, 1000]), raiseTo(40));
    expect(legalActions(state)?.raise?.min).toBe(70);
  });

  it('rejects a raise below the minimum', () => {
    const state = start([1000, 1000, 1000]);
    expect(() => applyAction(state, raiseTo(15))).toThrow();
  });

  it('rejects an illegal check and an illegal call', () => {
    const facing = start([100, 100, 100]);
    expect(() => applyAction(facing, CHECK)).toThrow();

    const free = play(facing, CALL, CALL);
    expect(() => applyAction(free, CALL)).toThrow();
  });

  it('allows an all-in for less than a minimum raise', () => {
    const state = play(start([1000, 1000, 35]), raiseTo(30));
    expect(state.toAct).toBe(1);
    const shortOnly = play(state, FOLD);
    expect(legalActions(shortOnly)?.raise).toEqual({ min: 35, max: 35 });
  });

  it('does not reopen betting after a short all-in', () => {
    // Seat 0 raises to 30, seat 1 calls, seat 2 is all-in for 35: not a full raise.
    const state = play(start([1000, 1000, 35]), raiseTo(30), CALL, raiseTo(35));
    expect(state.toAct).toBe(0);
    const legal = legalActions(state);
    expect(legal?.call).toBe(5);
    expect(legal?.raise).toBeNull();
  });

  it('reopens betting after a full raise', () => {
    const state = play(start([1000, 1000, 1000]), raiseTo(30), CALL, raiseTo(100));
    expect(legalActions(state)?.raise).not.toBeNull();
  });

  it('labels the first bet of a street as a bet', () => {
    const state = play(start([1000, 1000]), CALL, CHECK, raiseTo(20));
    const last = state.events.at(-1);
    expect(last).toMatchObject({ type: 'action', action: 'bet', amount: 20 });
  });
});

describe('ending a hand', () => {
  it('gives the pot to the last player when everyone else folds, showing no cards', () => {
    const state = play(start([100, 100, 100]), FOLD, FOLD);
    expect(state.result?.showdown).toBe(false);
    expect(stackOf(state, 2)).toBe(105);
    expect(stackOf(state, 1)).toBe(95);
  });

  it('deals every street and awards the best hand at showdown', () => {
    let state = rig(start([100, 100], 0), ['2c 7d', 'As Ah'], 'Kd 9h 4s 3c Jd');
    state = play(state, CALL, CHECK, CHECK, CHECK, CHECK, CHECK, CHECK, CHECK);

    expect(state.board).toEqual(cards('Kd 9h 4s 3c Jd'));
    expect(state.result?.showdown).toBe(true);
    expect(stackOf(state, 1)).toBe(110);
    expect(stackOf(state, 0)).toBe(90);
  });

  it('runs out the board when everyone is all-in', () => {
    let state = rig(start([50, 50], 0), ['As Ah', 'Kc Kd'], '2c 7d 9h Js 3c');
    state = play(state, raiseTo(50), CALL);

    expect(state.board).toHaveLength(5);
    expect(state.toAct).toBeNull();
    expect(stackOf(state, 0)).toBe(100);
  });

  it('returns chips nobody could match', () => {
    let state = rig(start([200, 50], 0), ['Kc Kd', 'As Ah'], '2c 7d 9h Js 3c');
    state = play(state, raiseTo(200), CALL);

    expect(stackOf(state, 1)).toBe(100);
    expect(stackOf(state, 0)).toBe(150);
  });

  it('splits a tied pot evenly', () => {
    let state = rig(start([100, 100, 100], 0), ['2c 3d', '4c 5d', '6c 7c'], 'As Ks Qs Js Ts');
    state = play(state, CALL, CALL, CHECK);
    state = play(state, CHECK, CHECK, CHECK, CHECK, CHECK, CHECK, CHECK, CHECK, CHECK);

    expect(state.players.map((player) => player.stack)).toEqual([100, 100, 100]);
  });

  it('gives the odd chip of a split pot to the first winner left of the button', () => {
    let state = rig(start([100, 100, 100], 0), ['2c 3d', '4c 5d', '6c 7c'], 'As Ks Qs Js Ts');
    // The small blind folds, leaving 25 to split between seats 0 and 2.
    state = play(state, CALL, FOLD, CHECK);
    state = play(state, CHECK, CHECK, CHECK, CHECK, CHECK, CHECK);

    expect(stackOf(state, 2)).toBe(103);
    expect(stackOf(state, 0)).toBe(102);
  });
});

describe('side pots', () => {
  it('builds a main pot and a side pot', () => {
    const pots = computePots([
      { seat: 0, status: 'all-in', totalBet: 50 },
      { seat: 1, status: 'active', totalBet: 200 },
      { seat: 2, status: 'active', totalBet: 200 },
    ]);
    expect(pots).toEqual([
      { amount: 150, eligible: [0, 1, 2] },
      { amount: 300, eligible: [1, 2] },
    ]);
  });

  it('counts chips from folded players but does not let them win', () => {
    const pots = computePots([
      { seat: 0, status: 'folded', totalBet: 30 },
      { seat: 1, status: 'active', totalBet: 100 },
      { seat: 2, status: 'all-in', totalBet: 100 },
    ]);
    expect(pots).toEqual([{ amount: 230, eligible: [1, 2] }]);
  });

  it('pays a short all-in only what it can win', () => {
    let state = rig(start([50, 200, 200], 0), ['As Ah', 'Kc Kd', 'Qc Qd'], '2c 7d 9h Js 3c');
    state = play(state, raiseTo(50), raiseTo(200), CALL);

    expect(state.result?.pots).toHaveLength(2);
    expect(stackOf(state, 0)).toBe(150);
    expect(stackOf(state, 1)).toBe(300);
    expect(stackOf(state, 2)).toBe(0);
  });
});

describe('what a seat can see', () => {
  it('hides other players cards, the deck, and the seed', () => {
    const view = viewFor(start([100, 100, 100]), 0);

    expect(view.players[0].hole).toHaveLength(2);
    expect(view.players[1].hole).toBeNull();
    expect(view.players[2].hole).toBeNull();
    expect(view).not.toHaveProperty('deck');
    expect(view).not.toHaveProperty('seed');
  });

  it('only gives legal actions to the seat whose turn it is', () => {
    const state = start([100, 100, 100]);
    expect(viewFor(state, 0).legal).not.toBeNull();
    expect(viewFor(state, 1).legal).toBeNull();
  });

  it('reveals cards at showdown but not after a fold-out', () => {
    let state = rig(start([100, 100], 0), ['2c 7d', 'As Ah'], 'Kd 9h 4s 3c Jd');
    state = play(state, CALL, CHECK, CHECK, CHECK, CHECK, CHECK, CHECK, CHECK);
    expect(viewFor(state, 0).players[1].hole).toEqual(cards('As Ah'));

    const folded = play(start([100, 100], 0), FOLD);
    expect(viewFor(folded, 1).players[0].hole).toBeNull();
  });
});

describe('table', () => {
  const newTable = (seatCount: number) =>
    createTable({
      variantId: 'holdem-nl',
      stakes: STAKES,
      startingStack: 100,
      baseSeed: 9,
      seatCount,
    });

  it('moves the button clockwise and carries stacks over', () => {
    let table = dealNextHand(newTable(3));
    if (!table?.hand) throw new Error('no hand');
    const firstButton = table.buttonSeat;

    let hand = table.hand;
    while (hand.toAct !== null) {
      const legal = legalActions(hand);
      hand = applyAction(hand, legal?.check ? CHECK : FOLD).state;
    }
    table = settleHand({ ...table, hand });
    expect(table.seats.reduce((sum, seat) => sum + seat.stack, 0)).toBe(300);

    const next = dealNextHand(table);
    expect(next?.buttonSeat).toBe((firstButton + 1) % 3);
  });

  it('skips players with no chips, until they rebuy', () => {
    let table = newTable(3);
    table = { ...table, seats: table.seats.map((s) => (s.seat === 1 ? { ...s, stack: 0 } : s)) };

    expect(dealNextHand(table)?.hand?.players).toHaveLength(2);
    expect(dealNextHand(rebuy(table, 1))?.hand?.players).toHaveLength(3);
  });

  it('deals the same cards for the same seed', () => {
    const a = dealNextHand(newTable(4))?.hand;
    const b = dealNextHand(newTable(4))?.hand;
    expect(a?.players).toEqual(b?.players);
  });

  it('names positions from the button', () => {
    const names = positionNames([0, 1, 2, 3, 4, 5], 2);
    expect(names.get(2)).toBe('BTN');
    expect(names.get(3)).toBe('SB');
    expect(names.get(4)).toBe('BB');
    expect(names.get(5)).toBe('UTG');
    expect(names.get(0)).toBe('HJ');
    expect(names.get(1)).toBe('CO');
  });
});

describe('random play', () => {
  function randomAction(state: HandState, rng: ReturnType<typeof createRng>): Action {
    const legal = legalActions(state);
    if (!legal) throw new Error('The hand is over');

    const options: Action[] = [];
    if (legal.fold) options.push(FOLD);
    if (legal.check) options.push(CHECK);
    if (legal.call !== null) options.push(CALL);
    if (legal.raise) {
      const { min, max } = legal.raise;
      options.push(raiseTo(min), raiseTo(max), raiseTo(min + rng.nextInt(max - min + 1)));
    }
    return options[rng.nextInt(options.length)];
  }

  it('always ends with every chip accounted for, across 5,000 random hands', () => {
    const rng = createRng(2026);

    for (let hand = 0; hand < 5000; hand++) {
      const seatCount = 2 + rng.nextInt(8);
      const stacks = Array.from({ length: seatCount }, () => 1 + rng.nextInt(400));
      let state = start(stacks, rng.nextInt(seatCount), rng.nextUint32());
      const chips = stacks.reduce((sum, stack) => sum + stack, 0);

      let steps = 0;
      while (state.toAct !== null) {
        expect(state.players.find((p) => p.seat === state.toAct)?.status).toBe('active');
        state = applyAction(state, randomAction(state, rng)).state;
        if (state.result === null) expect(totalChips(state)).toBe(chips);
        expect(++steps).toBeLessThan(300);
      }

      expect(state.players.reduce((sum, player) => sum + player.stack, 0)).toBe(chips);
      expect(state.players.every((player) => player.stack >= 0)).toBe(true);
      expect(state.result?.net.reduce((sum, entry) => sum + entry.amount, 0)).toBe(0);
    }
  });
});
