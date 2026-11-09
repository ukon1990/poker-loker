import type { PotAward, PotContender } from '@/engine/variants/types';

/** Splits a pot equally among the best hands. Odd chips go to the earliest winners. */
export function awardToBestHands(amount: number, contenders: readonly PotContender[]): PotAward[] {
  if (contenders.length === 0) throw new Error('A pot needs at least one contender');

  const bestRank = Math.max(...contenders.map((contender) => contender.rank));
  const winners = contenders.filter((contender) => contender.rank === bestRank);
  const share = Math.floor(amount / winners.length);
  const oddChips = amount - share * winners.length;

  return winners.map((winner, index) => ({
    seat: winner.seat,
    amount: share + (index < oddChips ? 1 : 0),
  }));
}
