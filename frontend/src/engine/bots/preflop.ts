import { type Card, type Rank, rankOf, suitOf } from '@/engine/core/cards';

// The Chen formula: a well-known way to score two starting cards by hand.
function chenScore(high: Rank, low: Rank, suited: boolean): number {
  const pair = high === low;
  let score = high === 14 ? 10 : high === 13 ? 8 : high === 12 ? 7 : high === 11 ? 6 : high / 2;

  if (pair) return Math.max(score * 2, 5);
  if (suited) score += 2;

  const gap = high - low - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && high < 12) score += 1;
  return score;
}

function handKey(high: Rank, low: Rank, suited: boolean): number {
  return high * 100 + low * 2 + (suited ? 1 : 0);
}

let percentiles: Map<number, number> | null = null;

function buildPercentiles(): Map<number, number> {
  const classes: { key: number; score: number; combos: number }[] = [];

  for (let high = 2; high <= 14; high++) {
    for (let low = 2; low <= high; low++) {
      if (high === low) {
        classes.push({
          key: handKey(high, low, false),
          score: chenScore(high, low, false),
          combos: 6,
        });
      } else {
        classes.push({
          key: handKey(high, low, true),
          score: chenScore(high, low, true),
          combos: 4,
        });
        classes.push({
          key: handKey(high, low, false),
          score: chenScore(high, low, false),
          combos: 12,
        });
      }
    }
  }
  classes.sort((a, b) => b.score - a.score || b.key - a.key);

  const result = new Map<number, number>();
  let stronger = 0;
  for (const entry of classes) {
    result.set(entry.key, (stronger + entry.combos / 2) / 1326);
    stronger += entry.combos;
  }
  return result;
}

/** Where two starting cards sit among all starting hands: near 0 is best, near 1 is worst. */
export function preflopPercentile(a: Card, b: Card): number {
  percentiles ??= buildPercentiles();
  const rankA = rankOf(a);
  const rankB = rankOf(b);
  const high = Math.max(rankA, rankB);
  const low = Math.min(rankA, rankB);
  return percentiles.get(handKey(high, low, suitOf(a) === suitOf(b))) ?? 1;
}
