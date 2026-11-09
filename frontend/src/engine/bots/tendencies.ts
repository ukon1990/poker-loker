import type { HandEvent } from '@/engine/core/hand';

/** What the table has seen a seat do. Built only from public actions. */
export interface SeatTendencies {
  hands: number;
  /** Times the seat faced a bet. */
  faced: number;
  /** Times the seat folded to a bet. */
  folded: number;
}

export type TableTendencies = Record<number, SeatTendencies>;

export function recordTendencies(
  previous: TableTendencies,
  seats: readonly number[],
  events: readonly HandEvent[],
): TableTendencies {
  const next: TableTendencies = { ...previous };

  for (const seat of seats) {
    const entry = { ...(next[seat] ?? { hands: 0, faced: 0, folded: 0 }) };
    entry.hands += 1;
    for (const event of events) {
      if (event.type !== 'action' || event.seat !== seat) continue;
      if (event.action === 'fold' || event.action === 'call' || event.action === 'raise') {
        entry.faced += 1;
      }
      if (event.action === 'fold') entry.folded += 1;
    }
    next[seat] = entry;
  }
  return next;
}
