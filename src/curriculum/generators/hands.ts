import type { Exercise } from '@/curriculum/exercises';
import { buildHand, optionSet, pick } from '@/curriculum/generators/shared';
import { type Card, rankOf } from '@/engine/core/cards';
import { buildDeck, STANDARD_52, shuffle } from '@/engine/core/deck';
import type { Rng } from '@/engine/core/rng';
import {
  CATEGORY_NAMES,
  describeHand,
  describeHandMarked,
  explainWin,
  rankName,
} from '@/engine/eval/describe';
import { bestRank } from '@/engine/eval/evaluate';
import { categoryOf, HandCategory, type HandRank, rankFive } from '@/engine/eval/rank';
import { holdemNoLimit } from '@/engine/variants/holdem';

export type Draft = Exercise extends infer E
  ? E extends Exercise
    ? Omit<E, 'skills'> & { skills?: string[] }
    : never
  : never;

const FULL_DECK = buildDeck(STANDARD_52);
const MAX_TRIES = 6000;

export function higherCard(_params: object, rng: Rng): Draft {
  const [first, second] = shuffle(FULL_DECK, rng).filter(
    (card, index, deck) => index === 0 || rankOf(card) !== rankOf(deck[0]),
  );
  const high = Math.max(rankOf(first), rankOf(second));
  const low = Math.min(rankOf(first), rankOf(second));
  const options = [rankName(rankOf(first)), rankName(rankOf(second))];

  return {
    kind: 'choice',
    prompt: 'Which card has the higher {rank}?',
    cards: [first, second],
    options,
    answer: options.indexOf(rankName(high)),
    explanation: `The ${rankName(high)} outranks the ${rankName(low)}. Aces are the highest card.`,
  };
}

export function deckFact(_params: object, rng: Rng): Draft {
  const { ranks, suits } = holdemNoLimit.deck;
  const facts = [
    {
      prompt: 'How many cards are in the deck?',
      value: ranks.length * suits.length,
      wrong: [48, 54, 26, 36],
    },
    { prompt: 'How many {suit|suits} are there?', value: suits.length, wrong: [2, 3, 5, 6] },
    {
      prompt: 'How many cards does each {suit} have?',
      value: ranks.length,
      wrong: [10, 12, 14, 15],
    },
  ];
  const fact = pick(facts, rng);
  const { options, answer } = optionSet(String(fact.value), fact.wrong.map(String), rng);
  return {
    kind: 'choice',
    prompt: fact.prompt,
    options,
    answer,
    explanation: `A standard deck has ${suits.length} suits of ${ranks.length} cards, which makes ${ranks.length * suits.length}.`,
  };
}

export function nameHand(params: { categories: HandCategory[] }, rng: Rng): Draft {
  const category = pick(params.categories, rng);
  const cards = buildHand(category, rng);
  const { options, answer } = optionSet(
    CATEGORY_NAMES[category],
    params.categories.map((value) => CATEGORY_NAMES[value]),
    rng,
  );
  return {
    kind: 'choice',
    prompt: 'What hand is this?',
    cards,
    options,
    answer,
    explanation: `This is ${describeHandMarked(rankFive(cards))}.`,
  };
}

function winnerIndex(rankA: HandRank, rankB: HandRank): number {
  return rankA === rankB ? 2 : rankA > rankB ? 0 : 1;
}

function explainResult(rankA: HandRank, rankB: HandRank): string {
  if (rankA === rankB)
    return `Both hands make ${describeHandMarked(rankA)}, so it is a {split-pot|split pot}.`;
  return rankA > rankB
    ? explainWin('Hand A', rankA, 'Hand B', rankB)
    : explainWin('Hand B', rankB, 'Hand A', rankA);
}

function compareExercise(
  board: Card[],
  handA: Card[],
  handB: Card[],
  rankA: HandRank,
  rankB: HandRank,
  offerSplit: boolean,
  prompt: string,
): Draft {
  return {
    kind: 'compare',
    prompt,
    board,
    hands: [
      { label: 'Hand A', cards: handA, result: CATEGORY_NAMES[categoryOf(rankA)] },
      { label: 'Hand B', cards: handB, result: CATEGORY_NAMES[categoryOf(rankB)] },
    ],
    offerSplit,
    answer: winnerIndex(rankA, rankB),
    explanation: explainResult(rankA, rankB),
  };
}

/** Compares two five-card hands, with no shared cards. */
export function compareHands(params: { categories: HandCategory[] }, rng: Rng): Draft {
  const [first, second] = shuffle(params.categories, rng);
  const handA = buildHand(first, rng);
  const handB = buildHand(second, rng, new Set(handA));
  return compareExercise(
    [],
    handA,
    handB,
    rankFive(handA),
    rankFive(handB),
    false,
    'Which hand wins?',
  );
}

type BoardPattern = 'any' | 'kicker' | 'board-plays' | 'tie';

export interface BoardCompareParams {
  winner?: HandCategory[];
  loser?: HandCategory[];
  pattern?: BoardPattern;
  offerSplit?: boolean;
}

function dealShared(rng: Rng) {
  const deck = shuffle(FULL_DECK, rng);
  return { board: deck.slice(0, 5), handA: deck.slice(5, 7), handB: deck.slice(7, 9) };
}

function rankBoth(deal: ReturnType<typeof dealShared>) {
  return {
    rankA: bestRank(holdemNoLimit, deal.handA, deal.board),
    rankB: bestRank(holdemNoLimit, deal.handB, deal.board),
  };
}

function fitsAny(rankA: HandRank, rankB: HandRank, params: BoardCompareParams): boolean {
  if (rankA === rankB || describeHand(rankA) === describeHand(rankB)) return false;
  const winner = categoryOf(Math.max(rankA, rankB));
  const loser = categoryOf(Math.min(rankA, rankB));
  return (
    (!params.winner || params.winner.includes(winner)) &&
    (!params.loser || params.loser.includes(loser))
  );
}

function fitsKicker(rankA: HandRank, rankB: HandRank): boolean {
  return rankA !== rankB && describeHand(rankA) === describeHand(rankB);
}

/** Two hands that both play the five cards on the board. */
function dealBoardPlays(rng: Rng) {
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const board = buildHand(HandCategory.Straight, rng);
    const used = new Set(board);
    const rest = shuffle(
      FULL_DECK.filter((card) => !used.has(card)),
      rng,
    );
    const handA = rest.slice(0, 2);
    const handB = rest.slice(2, 4);
    const boardRank = rankFive(board);
    if (
      bestRank(holdemNoLimit, handA, board) === boardRank &&
      bestRank(holdemNoLimit, handB, board) === boardRank
    ) {
      return { board, handA, handB };
    }
  }
  return null;
}

/** Two hands that tie using the same ranks from their hole cards. */
function dealTie(rng: Rng) {
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const deck = shuffle(FULL_DECK, rng);
    const handA = deck.slice(0, 2);
    const handB = deck
      .slice(2)
      .filter((card) => rankOf(card) === rankOf(handA[0]) || rankOf(card) === rankOf(handA[1]));
    const secondA = handB.find((card) => rankOf(card) === rankOf(handA[0]));
    const secondB = handB.find((card) => rankOf(card) === rankOf(handA[1]) && card !== secondA);
    if (!secondA || !secondB || rankOf(handA[0]) === rankOf(handA[1])) continue;

    const hole = [secondA, secondB];
    const used = new Set([...handA, ...hole]);
    const board = deck.filter((card) => !used.has(card)).slice(0, 5);
    const rankA = bestRank(holdemNoLimit, handA, board);
    if (rankA === bestRank(holdemNoLimit, hole, board) && rankA > rankFive(board)) {
      return { board, handA, handB: hole };
    }
  }
  return null;
}

/** Two hands sharing a board. The result always comes from the evaluator. */
export function boardCompare(params: BoardCompareParams, rng: Rng): Draft {
  const pattern = params.pattern ?? 'any';
  const prompt = 'Which hand wins?';
  const offerSplit = params.offerSplit ?? false;

  const constructed =
    pattern === 'board-plays' ? dealBoardPlays(rng) : pattern === 'tie' ? dealTie(rng) : null;
  if (constructed) {
    const { rankA, rankB } = rankBoth(constructed);
    return compareExercise(
      constructed.board,
      constructed.handA,
      constructed.handB,
      rankA,
      rankB,
      offerSplit,
      prompt,
    );
  }

  let deal = dealShared(rng);
  let ranks = rankBoth(deal);
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const fits =
      pattern === 'kicker'
        ? fitsKicker(ranks.rankA, ranks.rankB)
        : fitsAny(ranks.rankA, ranks.rankB, params);
    if (fits) break;
    deal = dealShared(rng);
    ranks = rankBoth(deal);
  }

  // A rare combination may not turn up. The answer is still calculated from these cards.
  while (ranks.rankA === ranks.rankB && !offerSplit) {
    deal = dealShared(rng);
    ranks = rankBoth(deal);
  }
  return compareExercise(
    deal.board,
    deal.handA,
    deal.handB,
    ranks.rankA,
    ranks.rankB,
    offerSplit,
    prompt,
  );
}

function dealSeven(category: HandCategory, rng: Rng) {
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const made = buildHand(category, rng);
    const used = new Set(made);
    const extras = shuffle(
      FULL_DECK.filter((card) => !used.has(card)),
      rng,
    ).slice(0, 2);
    const seven = shuffle([...made, ...extras], rng);
    const hole = seven.slice(0, 2);
    const board = seven.slice(2);
    if (categoryOf(bestRank(holdemNoLimit, hole, board)) === category) return { hole, board };
  }
  throw new Error(`Could not deal seven cards making category ${category}`);
}

export function bestFive(params: { categories: HandCategory[] }, rng: Rng): Draft {
  const { hole, board } = dealSeven(pick(params.categories, rng), rng);
  const rank = bestRank(holdemNoLimit, hole, board);
  return {
    kind: 'best-five',
    prompt: 'Tap the best five cards.',
    hole,
    board,
    bestRank: rank,
    explanation: `The cards with the green outline make ${describeHandMarked(rank)}.`,
  };
}

export function nameSeven(params: { categories: HandCategory[] }, rng: Rng): Draft {
  const category = pick(params.categories, rng);
  const { hole, board } = dealSeven(category, rng);
  const { options, answer } = optionSet(
    CATEGORY_NAMES[category],
    params.categories.map((value) => CATEGORY_NAMES[value]),
    rng,
  );
  return {
    kind: 'choice',
    prompt: 'What is the best hand you can make?',
    hole,
    board,
    options,
    answer,
    explanation: `Your best five cards make ${describeHandMarked(bestRank(holdemNoLimit, hole, board))}.`,
  };
}

export function orderHands(params: { categories: HandCategory[]; count: number }, rng: Rng): Draft {
  const used = new Set<Card>();
  const hands = shuffle(params.categories, rng)
    .slice(0, params.count)
    .map((category) => {
      const cards = buildHand(category, rng, used);
      for (const card of cards) used.add(card);
      return { cards, result: CATEGORY_NAMES[category] };
    });

  const order = hands
    .map((hand, index) => ({ index, rank: rankFive(hand.cards) }))
    .sort((a, b) => b.rank - a.rank)
    .map((entry) => entry.index);

  return {
    kind: 'order',
    prompt: 'Tap the hands from strongest to weakest.',
    hands,
    order,
    explanation: `From strongest to weakest: ${order.map((index) => hands[index].result).join(', ')}.`,
  };
}
