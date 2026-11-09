import type { Card } from '@/engine/core/cards';
import type { HandRank } from '@/engine/eval/rank';
import type { VariantDefinition } from '@/engine/variants/types';

export interface HandEvaluation {
  rank: HandRank;
  /** The five cards that make the hand. */
  cards: readonly Card[];
}

/** Finds a player's best hand under the variant's rules. */
export function evaluateHand(
  variant: VariantDefinition,
  hole: readonly Card[],
  board: readonly Card[],
): HandEvaluation {
  let best: HandEvaluation | null = null;

  for (const candidate of variant.candidateHands(hole, board)) {
    const rank = variant.rankHand(candidate);
    if (best === null || rank > best.rank) best = { rank, cards: candidate };
  }

  if (best === null) {
    throw new Error(`Cannot make a hand from ${hole.length} hole and ${board.length} board cards`);
  }
  return best;
}

const indexCache = new Map<string, number[][]>();
const scratch: Card[] = [];

// Which hole and board positions can form a hand depends only on how many cards there
// are, so the combinations are worked out once using positions in place of cards.
function candidateIndices(
  variant: VariantDefinition,
  holeCount: number,
  boardCount: number,
): number[][] {
  const key = `${variant.id}:${holeCount}:${boardCount}`;
  let indices = indexCache.get(key);
  if (!indices) {
    const hole = Array.from({ length: holeCount }, (_, i) => i as Card);
    const board = Array.from({ length: boardCount }, (_, i) => (i + holeCount) as Card);
    indices = variant.candidateHands(hole, board);
    indexCache.set(key, indices);
  }
  return indices;
}

/** The rank of a player's best hand, without allocating. For equity calculation. */
export function bestRank(
  variant: VariantDefinition,
  hole: readonly Card[],
  board: readonly Card[],
): HandRank {
  const holeCount = hole.length;
  let best = -1;

  for (const combo of candidateIndices(variant, holeCount, board.length)) {
    scratch.length = combo.length;
    for (let i = 0; i < combo.length; i++) {
      const index = combo[i];
      scratch[i] = index < holeCount ? hole[index] : board[index - holeCount];
    }
    const rank = variant.rankHand(scratch);
    if (rank > best) best = rank;
  }

  if (best < 0) {
    throw new Error(`Cannot make a hand from ${holeCount} hole and ${board.length} board cards`);
  }
  return best;
}
