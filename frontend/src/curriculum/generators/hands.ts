import type { Exercise } from '@/curriculum/exercises';
import { buildHand, optionSet, pick, tidyHand } from '@/curriculum/generators/shared';
import {
  LADDER,
  rarityNote,
  rungForTerm,
  rungOfRank,
  stepsAwayNote,
  wrongNameNote,
} from '@/curriculum/ladder';
import { ALL_RANKS, ALL_SUITS, type Card, makeCard, type Rank, rankOf } from '@/engine/core/cards';
import { combinations } from '@/engine/core/combinations';
import { buildDeck, STANDARD_52, shuffle } from '@/engine/core/deck';
import type { Rng } from '@/engine/core/rng';
import {
  CATEGORY_NAMES,
  describeHand,
  describeHandMarked,
  explainWin,
  firstDifference,
  handName,
  ROYAL_FLUSH,
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
const MAX_DEALS = 40;

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

type DeckFact = 'deck' | 'suits' | 'per-suit' | 'per-rank';

/** A question about the deck. Cards per rank is only asked for by name. */
export function deckFact(params: { fact?: DeckFact }, rng: Rng): Draft {
  const { ranks, suits } = holdemNoLimit.deck;
  const sizes = `A standard deck has ${suits.length} suits of ${ranks.length} cards, which makes ${ranks.length * suits.length}.`;
  const facts: Record<
    DeckFact,
    { prompt: string; value: number; wrong: number[]; explanation: string }
  > = {
    deck: {
      prompt: 'How many cards are in the deck?',
      value: ranks.length * suits.length,
      wrong: [48, 54, 26, 36],
      explanation: sizes,
    },
    suits: {
      prompt: 'How many {suit|suits} are there?',
      value: suits.length,
      wrong: [2, 3, 5, 6],
      explanation: sizes,
    },
    'per-suit': {
      prompt: 'How many cards does each {suit} have?',
      value: ranks.length,
      wrong: [10, 12, 14, 15],
      explanation: sizes,
    },
    'per-rank': {
      prompt: 'How many cards of each {rank} are in the deck?',
      value: suits.length,
      wrong: [2, 3, 5, 6],
      explanation: `Every {rank} appears once in each of the ${suits.length} {suit|suits}, so there are only ${suits.length} of each.`,
    },
  };
  const fact = params.fact
    ? facts[params.fact]
    : pick([facts.deck, facts.suits, facts['per-suit']], rng);
  const { options, answer } = optionSet(String(fact.value), fact.wrong.map(String), rng);
  return {
    kind: 'choice',
    prompt: fact.prompt,
    options,
    answer,
    explanation: fact.explanation,
  };
}

/** Wrong answers for naming a hand. A royal flush is a straight flush, so that is never wrong. */
function wrongHandNames(categories: readonly HandCategory[], correct: string): string[] {
  const straightFlush = CATEGORY_NAMES[HandCategory.StraightFlush];
  const names = categories.map((value) => CATEGORY_NAMES[value]);
  if (names.includes(straightFlush)) names.push(ROYAL_FLUSH);
  return correct === ROYAL_FLUSH ? names.filter((name) => name !== straightFlush) : names;
}

export function nameHand(
  params: {
    categories: HandCategory[];
    /** Always deal this hand, for a question straight after it is taught. */
    target?: HandCategory;
    /** Show the cards in order, for the first look at a new hand. */
    tidy?: boolean;
  },
  rng: Rng,
): Draft {
  let built = buildHand(params.target ?? pick(params.categories, rng), rng);
  // Asking for a straight flush means an ordinary one. A royal is its own hand to learners.
  while (
    params.target === HandCategory.StraightFlush &&
    handName(rankFive(built)) === ROYAL_FLUSH
  ) {
    built = buildHand(params.target, rng);
  }
  const cards = params.tidy ? tidyHand(built) : built;
  const rank = rankFive(cards);
  const correct = handName(rank);
  const { options, answer } = optionSet(correct, wrongHandNames(params.categories, correct), rng);
  return {
    kind: 'choice',
    prompt: 'What hand is this?',
    cards,
    options,
    answer,
    explanation: `This is ${describeHandMarked(rank)}.`,
    notes: options.map((option) => wrongNameNote(option, rungOfRank(rank))),
    // Tracks each hand on its own, so review can return to the ones that slip.
    skills: [`term:${rungOfRank(rank).termId}`],
  };
}

const LOOK_ALIKE_LABELS = ['A', 'B', 'C', 'D'];

/** What sets each look-alike apart from the others on the screen. */
const LOOK_ALIKE_REASONS: Partial<Record<string, string>> = {
  'royal-flush': 'ten to ace, all of one suit',
  'straight-flush': 'five in a row and one suit, but it does not reach the ace',
  straight: 'five in a row, but the suits are mixed',
  flush: 'all of one suit, but the cards do not run in order',
  'full-house': 'three of one rank and two of another',
  'three-of-a-kind': 'three of one rank, and the other two cards do not match',
  'two-pair': 'two pairs, and one card left over',
  'four-of-a-kind': 'all four cards of one rank',
  'high-card': 'no matching ranks, no run, and not all one suit',
  pair: 'two cards of one rank, and the rest do not match',
};

/** Hands around ten to ace, each a card or two away from the others. */
function royalLookAlikes(rng: Rng): Card[][] {
  const [suit, other] = shuffle(ALL_SUITS, rng);
  const run: readonly Rank[] = [10, 11, 12, 13, 14];
  const suited = (ranks: readonly Rank[]) => ranks.map((rank) => makeCard(rank, suit));
  const changed = rng.nextInt(run.length);
  return [
    suited(run),
    run.map((rank, index) => makeCard(rank, index === changed ? other : suit)),
    suited([9, 11, 12, 13, 14]),
    suited([9, 10, 11, 12, 13]),
  ];
}

/** Hands built from matching numbers, each a single card away from the full house. */
function matchingLookAlikes(rng: Rng): Card[][] {
  const [high, low, spare] = shuffle(ALL_RANKS, rng);
  const [a, b, c, d] = shuffle(ALL_SUITS, rng);
  const threes = [makeCard(high, a), makeCard(high, b), makeCard(high, c)];
  const lows = [makeCard(low, a), makeCard(low, b)];
  return [
    [...threes, ...lows],
    [...threes, lows[0], makeCard(spare, c)],
    [threes[0], threes[1], makeCard(spare, c), ...lows],
    [...threes, makeCard(high, d), lows[0]],
  ];
}

/** Hands around an ordinary run, one or two cards apart. */
function runLookAlikes(rng: Rng): Card[][] {
  const [suit, other, third] = shuffle(ALL_SUITS, rng);
  const pattern = [suit, other, third, suit, other];
  const mixed = (ranks: readonly Rank[]) =>
    ranks.map((rank, index) => makeCard(rank, pattern[index]));
  const low = 3 + rng.nextInt(6);
  const start = [low, low + 1, low + 2, low + 3];
  const broken = [...start, low + 6];
  return [
    mixed([...start, low + 4]),
    broken.map((rank) => makeCard(rank, suit)),
    mixed(broken),
    mixed([...start, low + 3]),
  ];
}

const LOOK_ALIKE_FAMILIES = {
  royal: royalLookAlikes,
  matching: matchingLookAlikes,
  run: runLookAlikes,
};

/** Whether a stronger hand on the screen also contains the one being asked for. */
const ASK_ONLY = new Set(['straight', 'flush', 'three-of-a-kind']);

/** Four similar hands side by side, so the one difference that matters stands out. */
export function lookAlike(
  params: { family: keyof typeof LOOK_ALIKE_FAMILIES; target: string },
  rng: Rng,
): Draft {
  const rung = rungForTerm(params.target);
  if (!rung) throw new Error(`Not a hand: ${params.target}`);

  const hands = shuffle(LOOK_ALIKE_FAMILIES[params.family](rng), rng).map((cards, index) => {
    const rank = rankFive(cards);
    return {
      label: LOOK_ALIKE_LABELS[index],
      // Kept as built, not sorted, so the same position holds the same card in every row.
      cards,
      result: handName(rank),
      termId: rungOfRank(rank).termId,
      phrase: rungOfRank(rank).phrase,
    };
  });
  const answer = hands.findIndex((hand) => hand.termId === params.target);
  const question =
    params.target === 'straight-flush'
      ? `${rung.phrase}, but not a royal flush`
      : params.family !== 'run' && ASK_ONLY.has(params.target)
        ? `only ${rung.phrase}`
        : rung.phrase;

  return {
    kind: 'compare',
    prompt: `Which one is ${question}?`,
    board: [],
    hands: hands.map(({ label, cards, result }) => ({ label, cards, result })),
    offerSplit: false,
    answer,
    explanation: `Hand ${hands[answer].label} is ${rung.phrase}: ${LOOK_ALIKE_REASONS[params.target]}.`,
    notes: hands.map((hand, index) =>
      index === answer
        ? undefined
        : `That one is ${hand.phrase}: ${LOOK_ALIKE_REASONS[hand.termId]}.`,
    ),
  };
}

/** Recalls the order itself: the hand directly above or below another. */
export function ladderNext(
  params: {
    /** The highest hand taught so far. Defaults to the whole ladder. */
    upTo?: string;
    direction?: 'up' | 'down';
  },
  rng: Rng,
): Draft {
  const top = LADDER.findIndex((rung) => rung.termId === params.upTo);
  const taught = top >= 0 ? LADDER.slice(0, top + 1) : LADDER;
  const up = params.direction ? params.direction === 'up' : rng.nextInt(2) === 0;
  const index = up ? rng.nextInt(taught.length - 1) : 1 + rng.nextInt(taught.length - 1);
  const from = taught[index];
  const target = taught[index + (up ? 1 : -1)];
  const nearby = taught.filter(
    (rung, position) => rung !== from && rung !== target && Math.abs(position - index) <= 3,
  );
  const { options, answer } = optionSet(
    target.name,
    nearby.map((rung) => rung.name),
    rng,
  );
  return {
    kind: 'choice',
    prompt: `Which hand is one step ${up ? 'stronger' : 'weaker'} than ${from.phrase}?`,
    options,
    answer,
    explanation: `The next step ${up ? 'up' : 'down'} from ${from.phrase} is ${target.phrase}.`,
    notes: options.map((option, index_) =>
      index_ === answer ? undefined : stepsAwayNote(option, from),
    ),
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
  extra: {
    /** One more sentence for the explanation. */
    note?: string;
    /** What to do differently, for a learner who picks a wrong answer. */
    wrongNote: string;
    showNames?: boolean;
  },
): Draft {
  const answer = winnerIndex(rankA, rankB);
  const explanation = explainResult(rankA, rankB);
  return {
    kind: 'compare',
    prompt,
    board,
    hands: [
      { label: 'Hand A', cards: handA, result: handName(rankA) },
      { label: 'Hand B', cards: handB, result: handName(rankB) },
    ],
    offerSplit,
    showNames: extra.showNames,
    answer,
    explanation: extra.note ? `${explanation} ${extra.note}` : explanation,
    notes: [0, 1, 2].map((index) => (index === answer ? undefined : extra.wrongNote)),
  };
}

export type HandPair = readonly [HandCategory, HandCategory];

const COMPARE_NOTE = 'Next time, name each hand first, then see which is higher on the ladder.';
const SAME_TYPE_NOTE =
  'The ladder cannot separate two hands of the same type. Compare the cards that make the hand.';
const BOARD_NOTE = 'Next time, find each player’s best five cards first, then compare them.';

const SIMILAR_DEALS = 40;

/** Of several deals, the one where the two hands look most alike. */
function mostAlike(first: HandCategory, second: HandCategory, rng: Rng): [Card[], Card[]] {
  const handA = buildHand(first, rng);
  let best: [Card[], Card[]] = [handA, buildHand(second, rng, new Set(handA))];
  let bestShared = -1;
  for (let tries = 0; tries < SIMILAR_DEALS; tries++) {
    const a = buildHand(first, rng);
    const b = buildHand(second, rng, new Set(a));
    const ranks = new Set(a.map(rankOf));
    const shared = b.filter((card) => ranks.has(rankOf(card))).length;
    if (shared > bestShared) {
      bestShared = shared;
      best = [a, b];
    }
  }
  return best;
}

/** Compares two five-card hands of different types, with no shared cards. */
export function compareHands(
  params: ({ categories: readonly HandCategory[] } | { pairs: readonly HandPair[] }) & {
    showNames?: boolean;
  },
  rng: Rng,
): Draft {
  let handA: Card[];
  let handB: Card[];
  if ('pairs' in params) {
    const [first, second] = shuffle(pick(params.pairs, rng), rng);
    [handA, handB] = mostAlike(first, second, rng);
  } else {
    const [first, second] = shuffle(params.categories, rng);
    handA = buildHand(first, rng);
    handB = buildHand(second, rng, new Set(handA));
  }
  const rankA = rankFive(handA);
  const rankB = rankFive(handB);
  return compareExercise([], handA, handB, rankA, rankB, false, 'Which hand wins?', {
    note: rarityNote(rankA, rankB),
    wrongNote: COMPARE_NOTE,
    showNames: params.showNames,
  });
}

const SAME_TYPE_RULES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'With no combination, the highest card decides.',
  [HandCategory.Pair]: 'The higher pair wins.',
  [HandCategory.TwoPair]: 'The higher of the two pairs is compared first.',
  [HandCategory.ThreeOfAKind]: 'The higher three of a kind wins.',
  [HandCategory.Straight]: 'The straight that reaches the higher card wins.',
  [HandCategory.Flush]: 'The highest card wins. Suits never matter.',
  [HandCategory.FullHouse]:
    'The three of a kind is compared first, whatever the pair is. Three tens beat three nines.',
  [HandCategory.FourOfAKind]: 'The higher four of a kind wins.',
  [HandCategory.StraightFlush]: 'The one that reaches the higher card wins.',
};

/** Two hands of one type that differ in the hand itself and not in a side card. */
function dealSameType(category: HandCategory, rng: Rng) {
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const handA = buildHand(category, rng);
    const handB = buildHand(category, rng, new Set(handA));
    const rankA = rankFive(handA);
    const rankB = rankFive(handB);
    if (describeHand(rankA) !== describeHand(rankB)) return { handA, handB, rankA, rankB };
  }
  throw new Error(`Could not deal two different hands of category ${category}`);
}

export function compareSame(params: { categories: readonly HandCategory[] }, rng: Rng): Draft {
  const category = pick(params.categories, rng);
  const { handA, handB, rankA, rankB } = dealSameType(category, rng);
  return compareExercise(
    [],
    handA,
    handB,
    rankA,
    rankB,
    false,
    'Same type of hand. Which one wins?',
    { note: SAME_TYPE_RULES[category], wrongNote: SAME_TYPE_NOTE },
  );
}

/** Shows choosing five cards from seven, with the chosen five outlined. */
export function workedBestFive(params: { categories: HandCategory[] }, rng: Rng): Draft {
  const { hole, board } = dealSeven(pick(params.categories, rng), rng);
  const rank = bestRank(holdemNoLimit, hole, board);
  return {
    kind: 'worked',
    prompt: 'Your best five of seven',
    board,
    hands: [{ label: 'Your cards', cards: hole, result: '' }],
    best: combinations([...hole, ...board], 5).find((hand) => rankFive(hand) === rank) ?? [],
    steps: [
      'You have seven cards to choose from: your two and the five on the board.',
      `Find the strongest hand any five can make. Here that is ${describeHand(rank)}.`,
      'Those five are your hand. The other two do not count.',
    ],
  };
}

/** Shows two equal hands being split by a side card. */
export function workedKicker(_params: object, rng: Rng): Draft {
  let deal = dealShared(rng);
  let ranks = rankBoth(deal);
  // A pair shows a side card most plainly. With high card, nothing sets it apart from the hand.
  const clearExample = (rankA: HandRank, rankB: HandRank) =>
    fitsKicker(rankA, rankB) && categoryOf(rankA) === HandCategory.Pair;
  for (let tries = 0; tries < MAX_TRIES && !clearExample(ranks.rankA, ranks.rankB); tries++) {
    deal = dealShared(rng);
    ranks = rankBoth(deal);
  }
  const { rankA, rankB } = ranks;
  const winner = rankA > rankB ? 'Hand A' : 'Hand B';
  return {
    kind: 'worked',
    prompt: 'When the hands match',
    board: deal.board,
    hands: [
      { label: 'Hand A', cards: deal.handA, result: handName(rankA) },
      { label: 'Hand B', cards: deal.handB, result: handName(rankB) },
    ],
    steps: [
      `Find each best five. Both hands make ${describeHand(rankA)}.`,
      `They match, so the kickers decide it: ${firstDifference(Math.max(rankA, rankB), Math.min(rankA, rankB))}.`,
      `So ${winner} wins.`,
    ],
  };
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Solves a comparison in front of the learner. With a same-type pair it shows that case. */
export function workedCompare(params: { pair: HandPair }, rng: Rng): Draft {
  const [first, second] = params.pair;
  const same = first === second;
  let handA: Card[];
  let handB: Card[];
  if (same) {
    ({ handA, handB } = dealSameType(first, rng));
  } else {
    handA = buildHand(first, rng);
    handB = buildHand(second, rng, new Set(handA));
  }
  const rankA = rankFive(handA);
  const rankB = rankFive(handB);
  const rungA = rungOfRank(rankA);
  const rungB = rungOfRank(rankB);
  const aWins = rankA > rankB;
  const winnerLabel = aWins ? 'Hand A' : 'Hand B';
  const [winner, loser] = aWins ? [rungA, rungB] : [rungB, rungA];

  const steps = same
    ? [
        `Name each hand. Each one is ${rungA.phrase}.`,
        `The ladder cannot separate them, so compare the hands. Hand A has ${describeHand(rankA)}. Hand B has ${describeHand(rankB)}.`,
        `${SAME_TYPE_RULES[first]} So ${winnerLabel} wins.`,
      ]
    : [
        `Name each hand. Hand A is ${rungA.phrase}. Hand B is ${rungB.phrase}.`,
        `Find them on the ladder. ${capitalised(winner.phrase)} is higher than ${loser.phrase}.`,
        `The higher hand wins, so ${winnerLabel} wins.`,
      ];

  return {
    kind: 'worked',
    prompt: same ? 'Two hands of the same type' : 'How to compare two hands',
    hands: [
      { label: 'Hand A', cards: tidyHand(handA), result: handName(rankA) },
      { label: 'Hand B', cards: tidyHand(handB), result: handName(rankB) },
    ],
    steps,
  };
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
  // Every card of a flush is part of the hand, so a flush has no kicker to teach.
  return (
    rankA !== rankB &&
    describeHand(rankA) === describeHand(rankB) &&
    categoryOf(rankA) !== HandCategory.Flush
  );
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
      { wrongNote: BOARD_NOTE },
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
    { wrongNote: BOARD_NOTE },
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
    notes: options.map((option) =>
      wrongNameNote(option, rungOfRank(bestRank(holdemNoLimit, hole, board))),
    ),
  };
}

/** One hand of each category, sharing no cards. */
function dealDistinctHands(categories: readonly HandCategory[], rng: Rng) {
  for (let tries = 0; tries < MAX_DEALS; tries++) {
    const used = new Set<Card>();
    try {
      // Rarest first: dealt last, four of a kind can find no rank with all four cards left.
      return [...categories]
        .sort((a, b) => b - a)
        .map((category) => {
          const cards = buildHand(category, rng, used);
          for (const card of cards) used.add(card);
          return { cards, rank: rankFive(cards), result: handName(rankFive(cards)) };
        });
    } catch {
      // Even so, the early hands can use up every way to make a later one. Deal again.
    }
  }
  throw new Error(`Could not deal hands of categories ${categories.join(', ')}`);
}

export function orderHands(params: { categories: HandCategory[]; count: number }, rng: Rng): Draft {
  const built = dealDistinctHands(shuffle(params.categories, rng).slice(0, params.count), rng);
  const hands = shuffle(built, rng);

  const order = hands
    .map((hand, index) => ({ index, rank: hand.rank }))
    .sort((a, b) => b.rank - a.rank)
    .map((entry) => entry.index);

  return {
    kind: 'order',
    prompt: 'Tap the hands from strongest to weakest.',
    hands: hands.map(({ cards, result }) => ({ cards, result })),
    order,
    explanation: `From strongest to weakest: ${order.map((index) => hands[index].result).join(', ')}.`,
  };
}

/** Orders the names alone, so it tests the ranking and not reading the cards. */
export function orderNames(params: { count: number }, rng: Rng): Draft {
  const rungs = shuffle(LADDER, rng).slice(0, params.count);
  const order = rungs
    .map((rung, index) => ({ index, height: LADDER.indexOf(rung) }))
    .sort((a, b) => b.height - a.height)
    .map((entry) => entry.index);

  return {
    kind: 'order',
    prompt: 'Tap these from strongest to weakest.',
    hands: rungs.map((rung) => ({ result: rung.name })),
    order,
    explanation: `From strongest to weakest: ${order.map((index) => rungs[index].name).join(', ')}.`,
  };
}

/** Shows the whole ranking, with this lesson's hands picked out. */
export function ladderStep(params: { prompt: string; intro: string; highlight: string[] }): Draft {
  return { kind: 'ladder', ...params };
}
