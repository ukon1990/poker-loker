import { preflopPercentile } from '@/engine/bots/preflop';
import type { Card } from '@/engine/core/cards';
import { buildDeck } from '@/engine/core/deck';
import type { Rng } from '@/engine/core/rng';
import { bestRank } from '@/engine/eval/evaluate';
import type { VariantDefinition } from '@/engine/variants/types';

export interface OpponentRange {
  /** Only starting hands at or better than this percentile are considered. 1 means any hand. */
  maxPercentile: number;
}

const MAX_RANGE_TRIES = 12;

/**
 * Estimates the share of the pot `hole` wins by playing out random boards against
 * opponents dealt random hands from their ranges. Returns 0 to 1, counting ties as shares.
 */
export function estimateEquity(
  variant: VariantDefinition,
  hole: readonly Card[],
  board: readonly Card[],
  opponents: readonly OpponentRange[],
  iterations: number,
  rng: Rng,
): number {
  const known = new Set<Card>([...hole, ...board]);
  const deck = buildDeck(variant.deck).filter((card) => !known.has(card));
  const totalBoard = variant.streets.reduce((sum, street) => sum + street.boardCards, 0);
  const missing = totalBoard - board.length;
  const usesPercentiles = variant.holeCards === 2;

  const fullBoard: Card[] = [...board, ...new Array<Card>(missing)];
  const hands = opponents.map(() => new Array<Card>(variant.holeCards));

  let remaining = deck.length;
  const draw = (): Card => {
    const index = rng.nextInt(remaining);
    remaining -= 1;
    const card = deck[index];
    deck[index] = deck[remaining];
    deck[remaining] = card;
    return card;
  };

  let total = 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    remaining = deck.length;

    for (let i = 0; i < opponents.length; i++) {
      const hand = hands[i];
      const { maxPercentile } = opponents[i];
      for (let tries = 0; ; tries++) {
        for (let c = 0; c < hand.length; c++) hand[c] = draw();
        if (
          !usesPercentiles ||
          maxPercentile >= 1 ||
          tries >= MAX_RANGE_TRIES ||
          preflopPercentile(hand[0], hand[1]) <= maxPercentile
        ) {
          break;
        }
        remaining += hand.length;
      }
    }

    for (let i = 0; i < missing; i++) fullBoard[board.length + i] = draw();

    const heroRank = bestRank(variant, hole, fullBoard);
    let best = heroRank;
    let tied = 1;
    let lost = false;
    for (const hand of hands) {
      const rank = bestRank(variant, hand, fullBoard);
      if (rank > best) {
        best = rank;
        lost = true;
      } else if (rank === best && !lost) {
        tied += 1;
      }
    }
    if (!lost) total += 1 / tied;
  }

  return total / iterations;
}
