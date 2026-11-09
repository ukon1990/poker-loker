import type { HandEvent } from '@/engine/core/hand';
import type { HandView, PublicPlayer } from '@/engine/core/view';
import type { OpponentRange } from '@/engine/equity/equity';

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/** How wide a player's range looks, from how they have bet so far this hand. */
function rangeFromActions(events: readonly HandEvent[], seat: number): number {
  let raises = 0;
  let calls = 0;
  let laterAggression = 0;

  for (const event of events) {
    if (event.type !== 'action' || event.seat !== seat) continue;
    const aggressive = event.action === 'raise' || event.action === 'bet';
    if (event.street === 0) {
      if (aggressive) raises += 1;
      if (event.action === 'call') calls += 1;
    } else if (aggressive) {
      laterAggression += 1;
    }
  }

  const preflop = raises >= 2 ? 0.07 : raises === 1 ? 0.2 : calls > 0 ? 0.45 : 1;
  return preflop * 0.75 ** laterAggression;
}

function hasActedVoluntarily(events: readonly HandEvent[], seat: number): boolean {
  return events.some((event) => event.type === 'action' && event.seat === seat);
}

/**
 * The opponents worth simulating, with an estimated range for each. `awareness` is how
 * much weight the betting gets: at 0 every opponent could hold anything.
 */
export function opponentRanges(view: HandView, awareness: number): OpponentRange[] {
  const live = view.players.filter(
    (player): player is PublicPlayer => player.seat !== view.seat && player.status !== 'folded',
  );

  const toRange = (seat: number): OpponentRange => ({
    maxPercentile: lerp(1, rangeFromActions(view.events, seat), awareness),
  });

  if (view.street > 0) return live.map((player) => toRange(player.seat));

  // Before the flop, most players who have yet to act will fold. Counting them all
  // would make every hand look hopeless.
  const acted = live.filter((player) => hasActedVoluntarily(view.events, player.seat));
  const waiting = live.filter((player) => !hasActedVoluntarily(view.events, player.seat));
  const expectedToPlay = Math.ceil(waiting.length * 0.3);
  const ranges = [
    ...acted.map((player) => toRange(player.seat)),
    ...waiting.slice(0, expectedToPlay).map(() => ({ maxPercentile: lerp(1, 0.6, awareness) })),
  ];
  return ranges.length > 0 ? ranges : [{ maxPercentile: 1 }];
}
