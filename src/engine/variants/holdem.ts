import { combinations } from '@/engine/core/combinations';
import { STANDARD_52 } from '@/engine/core/deck';
import { rankFive } from '@/engine/eval/rank';
import { awardToBestHands } from '@/engine/variants/shared';
import type { VariantDefinition } from '@/engine/variants/types';

export const holdemNoLimit: VariantDefinition = {
  id: 'holdem-nl',
  name: "No-Limit Texas Hold'em",
  deck: STANDARD_52,
  holeCards: 2,
  streets: [
    { id: 'preflop', label: 'Pre-flop', boardCards: 0 },
    { id: 'flop', label: 'Flop', boardCards: 3 },
    { id: 'turn', label: 'Turn', boardCards: 1 },
    { id: 'river', label: 'River', boardCards: 1 },
  ],
  forcedBets: { blinds: true, antes: false },
  structure: 'no-limit',
  // Any five of the hole and board cards. The board alone can be the best hand.
  candidateHands: (hole, board) => combinations([...hole, ...board], 5),
  rankHand: rankFive,
  awardPot: awardToBestHands,
};
