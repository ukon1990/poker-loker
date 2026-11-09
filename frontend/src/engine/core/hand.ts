import type { Card } from '@/engine/core/cards';
import { buildDeck, shuffle } from '@/engine/core/deck';
import { createRng } from '@/engine/core/rng';
import { bestRank } from '@/engine/eval/evaluate';
import type { HandRank } from '@/engine/eval/rank';
import { getVariant } from '@/engine/variants';
import type { PotAward, VariantId } from '@/engine/variants/types';

export interface Stakes {
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

export type PlayerStatus = 'active' | 'folded' | 'all-in';

export interface PlayerState {
  seat: number;
  stack: number;
  hole: Card[];
  status: PlayerStatus;
  /** Chips put in on the current street. */
  streetBet: number;
  /** Chips put in during the whole hand. */
  totalBet: number;
  /** Value of `fullRaises` when this player last acted this street, or -1 if they have not. */
  actedAt: number;
}

/** `to` is the player's total bet on the street after the raise. A first bet is also a raise. */
export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; to: number };

export type PublicAction = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export type HandEvent =
  | { type: 'forced'; seat: number; kind: 'small-blind' | 'big-blind' | 'ante'; amount: number }
  | {
      type: 'action';
      seat: number;
      street: number;
      action: PublicAction;
      /** Chips added by this action. */
      amount: number;
      /** The player's total bet on this street afterwards. */
      to: number;
      allIn: boolean;
    }
  | { type: 'street'; street: number; cards: Card[] }
  | { type: 'showdown'; seat: number; hole: Card[]; rank: HandRank }
  | { type: 'award'; seat: number; amount: number; potIndex: number };

export interface Pot {
  amount: number;
  eligible: number[];
}

export interface HandResult {
  pots: Pot[];
  awards: PotAward[];
  /** Whether cards were compared. False when everyone else folded. */
  showdown: boolean;
  /** Chips won or lost by each seat over the whole hand. */
  net: PotAward[];
}

export interface HandState {
  variantId: VariantId;
  seed: number;
  stakes: Stakes;
  buttonSeat: number;
  /** Sorted by seat, which is also clockwise order. */
  players: PlayerState[];
  /** Undealt cards. The next card dealt is the last one. */
  deck: Card[];
  board: Card[];
  street: number;
  currentBet: number;
  lastRaiseSize: number;
  /** Counts full raises this street. A short all-in does not reopen the betting. */
  fullRaises: number;
  toAct: number | null;
  events: HandEvent[];
  result: HandResult | null;
}

export interface LegalActions {
  fold: boolean;
  check: boolean;
  /** Chips needed to call, or null if there is nothing to call. */
  call: number | null;
  raise: { min: number; max: number } | null;
}

const NOT_ACTED = -1;

/** Everyone clockwise after `seat`, ending with `seat` itself if they are in the list. */
export function seatsAfter<T extends { seat: number }>(players: readonly T[], seat: number): T[] {
  const first = players.findIndex((player) => player.seat > seat);
  const pivot = first === -1 ? 0 : first;
  return [...players.slice(pivot), ...players.slice(0, pivot)];
}

function findPlayer(state: HandState, seat: number): PlayerState {
  const player = state.players.find((candidate) => candidate.seat === seat);
  if (!player) throw new Error(`No player in seat ${seat}`);
  return player;
}

function post(player: PlayerState, amount: number, countsOnStreet: boolean): number {
  const paid = Math.min(player.stack, amount);
  player.stack -= paid;
  player.totalBet += paid;
  if (countsOnStreet) player.streetBet += paid;
  if (player.stack === 0) player.status = 'all-in';
  return paid;
}

function highestOtherBet(state: HandState, player: PlayerState): number {
  let highest = 0;
  for (const other of state.players) {
    if (other !== player && other.status !== 'folded') {
      highest = Math.max(highest, other.streetBet);
    }
  }
  return highest;
}

function activeCount(state: HandState): number {
  return state.players.filter((player) => player.status === 'active').length;
}

/** The street bet this player has to match. */
function callTarget(state: HandState, player: PlayerState): number {
  // Alone with chips, there is no one to pay beyond what the all-in players have put in.
  return activeCount(state) === 1
    ? Math.min(state.currentBet, highestOtherBet(state, player))
    : state.currentBet;
}

function needsAction(state: HandState, player: PlayerState): boolean {
  if (player.status !== 'active') return false;
  if (activeCount(state) === 1) return player.streetBet < highestOtherBet(state, player);
  return player.actedAt === NOT_ACTED || player.streetBet < state.currentBet;
}

export function legalActions(state: HandState): LegalActions | null {
  if (state.toAct === null) return null;

  const player = findPlayer(state, state.toAct);
  const owed = Math.max(0, callTarget(state, player) - player.streetBet);
  const allInTo = player.streetBet + player.stack;
  // A player who has acted can only raise again after a full raise reopens the betting.
  const canRaise =
    activeCount(state) > 1 && player.actedAt < state.fullRaises && allInTo > state.currentBet;

  return {
    fold: owed > 0,
    check: owed === 0,
    call: owed > 0 ? Math.min(owed, player.stack) : null,
    raise: canRaise
      ? { min: Math.min(state.currentBet + state.lastRaiseSize, allInTo), max: allInTo }
      : null,
  };
}

/**
 * Splits the money into a main pot and side pots. A player can only win from layers
 * they have fully paid into. Chips nobody matched form a layer that returns to the bettor.
 */
export function computePots(
  players: readonly Pick<PlayerState, 'seat' | 'status' | 'totalBet'>[],
): Pot[] {
  const contenders = players.filter((player) => player.status !== 'folded');
  const levels = [...new Set(contenders.map((player) => player.totalBet))]
    .filter((level) => level > 0)
    .sort((a, b) => a - b);

  const pots: Pot[] = [];
  let previous = 0;
  for (const level of levels) {
    let amount = 0;
    for (const player of players) {
      amount += Math.min(player.totalBet, level) - Math.min(player.totalBet, previous);
    }
    pots.push({
      amount,
      eligible: contenders.filter((player) => player.totalBet >= level).map((p) => p.seat),
    });
    previous = level;
  }

  // A folded player can have paid more than any contender, such as a short big blind's opponent.
  const dead = players.reduce((sum, player) => sum + Math.max(0, player.totalBet - previous), 0);
  if (dead > 0 && pots.length > 0) pots[pots.length - 1].amount += dead;
  return pots;
}

function finish(state: HandState, emit: (event: HandEvent) => void): void {
  state.toAct = null;

  const variant = getVariant(state.variantId);
  const order = seatsAfter(state.players, state.buttonSeat);
  const contenders = order.filter((player) => player.status !== 'folded');
  const showdown = contenders.length > 1;
  const ranks = new Map<number, HandRank>();

  if (showdown) {
    for (const player of contenders) {
      const rank = bestRank(variant, player.hole, state.board);
      ranks.set(player.seat, rank);
      emit({ type: 'showdown', seat: player.seat, hole: player.hole, rank });
    }
  }

  const pots = computePots(state.players);
  const totals = new Map<number, number>();

  pots.forEach((pot, potIndex) => {
    const eligible = order.filter((player) => pot.eligible.includes(player.seat));
    const awards =
      eligible.length === 1
        ? [{ seat: eligible[0].seat, amount: pot.amount }]
        : variant.awardPot(
            pot.amount,
            eligible.map((player) => ({
              seat: player.seat,
              hole: player.hole,
              rank: ranks.get(player.seat) ?? 0,
            })),
            state.board,
          );

    for (const award of awards) {
      findPlayer(state, award.seat).stack += award.amount;
      totals.set(award.seat, (totals.get(award.seat) ?? 0) + award.amount);
      emit({ type: 'award', seat: award.seat, amount: award.amount, potIndex });
    }
  });

  state.result = {
    pots,
    showdown,
    awards: [...totals].map(([seat, amount]) => ({ seat, amount })),
    net: state.players.map((player) => ({
      seat: player.seat,
      amount: (totals.get(player.seat) ?? 0) - player.totalBet,
    })),
  };
}

function openNextStreet(state: HandState, emit: (event: HandEvent) => void): void {
  const variant = getVariant(state.variantId);

  state.street += 1;
  state.currentBet = 0;
  state.lastRaiseSize = state.stakes.bigBlind;
  state.fullRaises = 0;
  for (const player of state.players) {
    player.streetBet = 0;
    player.actedAt = NOT_ACTED;
  }

  const count = variant.streets[state.street].boardCards;
  const dealt = state.deck.slice(state.deck.length - count).reverse();
  state.deck = state.deck.slice(0, state.deck.length - count);
  state.board = [...state.board, ...dealt];
  emit({ type: 'street', street: state.street, cards: dealt });
}

/** Moves play on: to the next player, the next street, or the end of the hand. */
function advance(state: HandState, afterSeat: number, emit: (event: HandEvent) => void): void {
  const variant = getVariant(state.variantId);
  const stillIn = state.players.filter((player) => player.status !== 'folded');
  if (stillIn.length === 1) {
    finish(state, emit);
    return;
  }

  let after = afterSeat;
  while (true) {
    const next = seatsAfter(state.players, after).find((p) => needsAction(state, p));
    if (next) {
      state.toAct = next.seat;
      return;
    }
    if (state.street === variant.streets.length - 1) {
      finish(state, emit);
      return;
    }
    // With at most one player able to bet, this loop deals out the rest of the board.
    openNextStreet(state, emit);
    after = state.buttonSeat;
  }
}

export interface StartHandInput {
  variantId: VariantId;
  seed: number;
  stakes: Stakes;
  buttonSeat: number;
  seats: readonly { seat: number; stack: number }[];
}

export function startHand(input: StartHandInput): HandState {
  const { variantId, seed, stakes, buttonSeat, seats } = input;
  const variant = getVariant(variantId);
  if (variant.structure !== 'no-limit') {
    throw new Error(`Betting structure not implemented: ${variant.structure}`);
  }

  const players: PlayerState[] = seats
    .filter((entry) => entry.stack > 0)
    .sort((a, b) => a.seat - b.seat)
    .map((entry) => ({
      seat: entry.seat,
      stack: entry.stack,
      hole: [],
      status: 'active',
      streetBet: 0,
      totalBet: 0,
      actedAt: NOT_ACTED,
    }));

  if (players.length < 2) throw new Error('A hand needs at least two players with chips');
  if (!players.some((player) => player.seat === buttonSeat)) {
    throw new Error(`The button is on an empty seat: ${buttonSeat}`);
  }

  const deck = shuffle(buildDeck(variant.deck), createRng(seed));
  const order = seatsAfter(players, buttonSeat);
  const headsUp = players.length === 2;
  // Heads-up the button posts the small blind, and acts first before the flop.
  const smallBlind = headsUp ? order[1] : order[0];
  const bigBlind = headsUp ? order[0] : order[1];

  const events: HandEvent[] = [];
  const emit = (event: HandEvent) => events.push(event);

  if (variant.forcedBets.antes && stakes.ante > 0) {
    for (const player of order) {
      emit({
        type: 'forced',
        seat: player.seat,
        kind: 'ante',
        amount: post(player, stakes.ante, false),
      });
    }
  }
  emit({
    type: 'forced',
    seat: smallBlind.seat,
    kind: 'small-blind',
    amount: post(smallBlind, stakes.smallBlind, true),
  });
  emit({
    type: 'forced',
    seat: bigBlind.seat,
    kind: 'big-blind',
    amount: post(bigBlind, stakes.bigBlind, true),
  });

  for (let round = 0; round < variant.holeCards; round++) {
    for (const player of order) player.hole.push(deck.pop() as Card);
  }

  const state: HandState = {
    variantId,
    seed,
    stakes,
    buttonSeat,
    players,
    deck,
    board: [],
    street: 0,
    currentBet: stakes.bigBlind,
    lastRaiseSize: stakes.bigBlind,
    fullRaises: 0,
    toAct: null,
    events,
    result: null,
  };

  advance(state, bigBlind.seat, emit);
  return state;
}

export function applyAction(
  state: HandState,
  action: Action,
): { state: HandState; events: HandEvent[] } {
  const legal = legalActions(state);
  if (!legal || state.toAct === null) throw new Error('The hand is already over');

  const next: HandState = {
    ...state,
    players: state.players.map((player) => ({ ...player })),
    events: [...state.events],
  };
  const events: HandEvent[] = [];
  const emit = (event: HandEvent) => {
    events.push(event);
    next.events.push(event);
  };

  const player = findPlayer(next, state.toAct);
  const record = (publicAction: PublicAction, amount: number) =>
    emit({
      type: 'action',
      seat: player.seat,
      street: next.street,
      action: publicAction,
      amount,
      to: player.streetBet,
      allIn: player.status === 'all-in',
    });

  switch (action.type) {
    case 'fold': {
      if (!legal.fold) throw new Error('There is nothing to fold to');
      player.status = 'folded';
      record('fold', 0);
      break;
    }
    case 'check': {
      if (!legal.check) throw new Error('Cannot check when facing a bet');
      record('check', 0);
      break;
    }
    case 'call': {
      if (legal.call === null) throw new Error('There is nothing to call');
      record('call', post(player, legal.call, true));
      break;
    }
    case 'raise': {
      if (!legal.raise) throw new Error('Raising is not allowed here');
      if (action.to < legal.raise.min || action.to > legal.raise.max) {
        throw new Error(`Raise to ${action.to} is outside ${legal.raise.min}–${legal.raise.max}`);
      }
      const isFirstBet = next.currentBet === 0;
      const raisedBy = action.to - next.currentBet;
      if (raisedBy >= next.lastRaiseSize) {
        next.lastRaiseSize = raisedBy;
        next.fullRaises += 1;
      }
      next.currentBet = action.to;
      record(isFirstBet ? 'bet' : 'raise', post(player, action.to - player.streetBet, true));
      break;
    }
  }

  player.actedAt = next.fullRaises;
  advance(next, player.seat, emit);
  return { state: next, events };
}
