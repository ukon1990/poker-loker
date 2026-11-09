import { type HandState, type Stakes, seatsAfter, startHand } from '@/engine/core/hand';
import { deriveSeed } from '@/engine/core/rng';
import type { VariantId } from '@/engine/variants/types';

export interface TableSeat {
  seat: number;
  stack: number;
}

/** A series of hands. Plain data, so it can be saved and resumed. */
export interface TableState {
  variantId: VariantId;
  stakes: Stakes;
  startingStack: number;
  baseSeed: number;
  handNumber: number;
  buttonSeat: number;
  seats: TableSeat[];
  hand: HandState | null;
}

export function createTable(input: {
  variantId: VariantId;
  stakes: Stakes;
  startingStack: number;
  baseSeed: number;
  seatCount: number;
}): TableState {
  const { seatCount, startingStack, baseSeed } = input;
  return {
    variantId: input.variantId,
    stakes: input.stakes,
    startingStack,
    baseSeed,
    handNumber: 0,
    buttonSeat: deriveSeed(baseSeed, 0x627574) % seatCount,
    seats: Array.from({ length: seatCount }, (_, seat) => ({ seat, stack: startingStack })),
    hand: null,
  };
}

/** Copies the chips from a finished hand back to the table. */
export function settleHand(table: TableState): TableState {
  const { hand } = table;
  if (!hand?.result) return table;

  return {
    ...table,
    seats: table.seats.map((entry) => {
      const player = hand.players.find((candidate) => candidate.seat === entry.seat);
      return player ? { ...entry, stack: player.stack } : entry;
    }),
    hand: null,
  };
}

export function rebuy(table: TableState, seat: number): TableState {
  return {
    ...table,
    seats: table.seats.map((entry) =>
      entry.seat === seat && entry.stack === 0 ? { ...entry, stack: table.startingStack } : entry,
    ),
  };
}

/** Moves the button clockwise and deals. Returns null if fewer than two players have chips. */
export function dealNextHand(table: TableState): TableState | null {
  const funded = table.seats.filter((entry) => entry.stack > 0);
  if (funded.length < 2) return null;

  const handNumber = table.handNumber + 1;
  const buttonSeat =
    handNumber === 1 && funded.some((entry) => entry.seat === table.buttonSeat)
      ? table.buttonSeat
      : seatsAfter(funded, table.buttonSeat)[0].seat;

  return {
    ...table,
    handNumber,
    buttonSeat,
    hand: startHand({
      variantId: table.variantId,
      seed: deriveSeed(table.baseSeed, handNumber),
      stakes: table.stakes,
      buttonSeat,
      seats: funded,
    }),
  };
}

const POSITIONS: Record<number, readonly string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'],
};

/** The position name of each seat, keyed by seat. */
export function positionNames(seats: readonly number[], buttonSeat: number): Map<number, string> {
  const sorted = [...seats].sort((a, b) => a - b).map((seat) => ({ seat }));
  const order = seatsAfter(sorted, buttonSeat);
  // `order` ends with the button, so rotate it to start there.
  const fromButton = [order[order.length - 1], ...order.slice(0, -1)];
  const names = POSITIONS[seats.length] ?? [];
  return new Map(fromButton.map((entry, index) => [entry.seat, names[index] ?? '']));
}
