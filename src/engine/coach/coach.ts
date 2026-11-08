import { opponentRanges } from '@/engine/bots/ranges';
import { type Card, suitOf } from '@/engine/core/cards';
import { buildDeck } from '@/engine/core/deck';
import type { Rng } from '@/engine/core/rng';
import type { HandView } from '@/engine/core/view';
import { estimateEquity } from '@/engine/equity/equity';
import { describeHandMarked } from '@/engine/eval/describe';
import { bestRank } from '@/engine/eval/evaluate';
import { categoryOf, HandCategory } from '@/engine/eval/rank';
import { getVariant } from '@/engine/variants';
import type { VariantDefinition } from '@/engine/variants/types';

export type CoachRecommendation = 'fold' | 'check' | 'call' | 'raise';

export interface CoachAdvice {
  /** Chips needed to call. 0 when there is nothing to call. */
  toCall: number;
  /** The pot, including all bets so far. */
  toWin: number;
  /** The share of the pot a call must win to break even. Null when there is nothing to call. */
  needed: number | null;
  /** Estimated share of the pot this hand wins against likely opponent hands. */
  equity: number;
  recommendation: CoachRecommendation;
  /** Plain-language reason, with terms marked for the glossary. */
  text: string;
}

const COACH_ITERATIONS = 1500;
const CLOSE_MARGIN = 0.03;
const RAISE_MARGIN = 0.2;
const LIKELY_AHEAD = 0.6;

const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
];

const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];

/** Describes a flush or straight draw, by trying every card that could come next. */
function describeDraw(
  variant: VariantDefinition,
  hole: readonly Card[],
  board: readonly Card[],
): string | null {
  if (board.length < 3 || board.length >= 5) return null;

  const current = categoryOf(bestRank(variant, hole, board));
  const seen = new Set<Card>([...hole, ...board]);
  const flushOuts: Card[] = [];
  let straightOuts = 0;

  for (const card of buildDeck(variant.deck)) {
    if (seen.has(card)) continue;
    const category = categoryOf(bestRank(variant, hole, [...board, card]));
    const heroHoldsSuit = hole.some((holeCard) => suitOf(holeCard) === suitOf(card));

    if (category === HandCategory.Flush && current < HandCategory.Flush && heroHoldsSuit) {
      flushOuts.push(card);
    } else if (category === HandCategory.Straight && current < HandCategory.Straight) {
      straightOuts += 1;
    }
  }

  if (flushOuts.length >= 7) {
    const word = NUMBER_WORDS[flushOuts.length];
    return `${word} ${SUIT_NAMES[suitOf(flushOuts[0])]} complete your {flush}.`;
  }
  if (straightOuts >= 4) {
    return `${NUMBER_WORDS[straightOuts]} cards complete your {straight}.`;
  }
  return null;
}

function describeHolding(
  variant: VariantDefinition,
  hole: readonly Card[],
  board: readonly Card[],
): string {
  if (board.length < 3) return 'This is your starting hand.';
  const made = `You have ${describeHandMarked(bestRank(variant, hole, board))}.`;
  const draw = describeDraw(variant, hole, board);
  return draw ? `${made} ${draw}` : made;
}

/** A rule-of-thumb recommendation. It is a heuristic, and is labelled as one in the UI. */
export function coachAdvice(view: HandView, rng: Rng, iterations = COACH_ITERATIONS): CoachAdvice {
  const { legal } = view;
  const me = view.players.find((player) => player.seat === view.seat);
  if (!legal || !me?.hole) throw new Error('The coach can only advise on your turn');

  const variant = getVariant(view.variantId);
  const equity = estimateEquity(
    variant,
    me.hole,
    view.board,
    opponentRanges(view, 0.8),
    iterations,
    rng,
  );

  const holding = describeHolding(variant, me.hole, view.board);
  const toCall = legal.call ?? 0;

  if (toCall === 0) {
    const ahead = equity >= LIKELY_AHEAD && legal.raise !== null;
    return {
      toCall,
      toWin: view.pot,
      needed: null,
      equity,
      recommendation: ahead ? 'raise' : 'check',
      text: `${holding} ${
        ahead
          ? 'You are likely ahead, so a {bet} is reasonable.'
          : 'You are not clearly ahead, so {check|checking} is fine.'
      }`,
    };
  }

  const needed = toCall / (view.pot + toCall);
  const margin = equity - needed;

  let recommendation: CoachRecommendation;
  let verdict: string;
  if (margin >= RAISE_MARGIN && legal.raise) {
    recommendation = 'raise';
    verdict = 'You are well ahead of the price, so {raise|raising} is reasonable.';
  } else if (margin >= CLOSE_MARGIN) {
    recommendation = 'call';
    verdict = 'That beats the price, so {call|calling} is reasonable.';
  } else if (margin >= -CLOSE_MARGIN) {
    recommendation = 'call';
    verdict = 'That is close to the price, so {call|calling} or {fold|folding} are both fine.';
  } else {
    recommendation = 'fold';
    verdict = 'That is less than the price, so {fold|folding} is reasonable.';
  }

  return {
    toCall,
    toWin: view.pot,
    needed,
    equity,
    recommendation,
    text: `${holding} ${verdict}`,
  };
}
