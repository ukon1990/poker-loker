import type { Draft } from '@/curriculum/generators/hands';
import { optionSet, pick } from '@/curriculum/generators/shared';
import { preflopPercentile } from '@/engine/bots/preflop';
import { type Card, rankOf, suitOf } from '@/engine/core/cards';
import { buildDeck, STANDARD_52, shuffle } from '@/engine/core/deck';
import type { Rng } from '@/engine/core/rng';
import { describeHandMarked, rankName } from '@/engine/eval/describe';
import { bestRank } from '@/engine/eval/evaluate';
import { categoryOf, HandCategory, rankFive } from '@/engine/eval/rank';
import { holdemNoLimit } from '@/engine/variants/holdem';

const FULL_DECK = buildDeck(STANDARD_52);
const MAX_TRIES = 8000;

function startingHandName(hole: readonly Card[]): string {
  const [high, low] = [...hole].sort((a, b) => rankOf(b) - rankOf(a));
  if (rankOf(high) === rankOf(low)) return `a pair of ${rankName(rankOf(high))}s`;
  const suited = suitOf(high) === suitOf(low) ? 'suited' : 'offsuit';
  return `${rankName(rankOf(high))}-${rankName(rankOf(low))} ${suited}`;
}

function topPercent(percentile: number): number {
  return Math.max(1, Math.round(percentile * 100));
}

export function strongerStart(_params: object, rng: Rng): Draft {
  for (let tries = 0; ; tries++) {
    const deck = shuffle(FULL_DECK, rng);
    const handA = deck.slice(0, 2);
    const handB = deck.slice(2, 4);
    const a = preflopPercentile(handA[0], handA[1]);
    const b = preflopPercentile(handB[0], handB[1]);
    if (Math.abs(a - b) < 0.15 && tries < MAX_TRIES) continue;

    const winner = a <= b ? 'Hand A' : 'Hand B';
    return {
      kind: 'compare',
      prompt: 'Which starting hand is stronger?',
      board: [],
      hands: [
        { label: 'Hand A', cards: handA, result: `Top ${topPercent(a)}%` },
        { label: 'Hand B', cards: handB, result: `Top ${topPercent(b)}%` },
      ],
      offerSplit: false,
      answer: a <= b ? 0 : 1,
      explanation: `${winner}, ${startingHandName(a <= b ? handA : handB)}, ranks higher among all starting hands than ${startingHandName(a <= b ? handB : handA)}.`,
    };
  }
}

const OPENING_RANGES = {
  'under-the-gun': { label: '{under-the-gun|under the gun}', top: 0.14 },
  hijack: { label: 'in the {hijack}', top: 0.2 },
  cutoff: { label: 'in the {cutoff}', top: 0.27 },
  button: { label: 'on the {button}', top: 0.42 },
} as const;

export type OpeningSeat = keyof typeof OPENING_RANGES;

export function openOrFold(params: { seats: OpeningSeat[] }, rng: Rng): Draft {
  const seat = OPENING_RANGES[pick(params.seats, rng)];

  for (let tries = 0; ; tries++) {
    const hole = shuffle(FULL_DECK, rng).slice(0, 2);
    const percentile = preflopPercentile(hole[0], hole[1]);
    if (Math.abs(percentile - seat.top) < 0.06 && tries < MAX_TRIES) continue;

    const shouldRaise = percentile <= seat.top;
    const options = ['Fold', 'Raise'];
    return {
      kind: 'choice',
      prompt: `Everyone before you folded. You are ${seat.label}. What do you do?`,
      hole,
      options,
      answer: options.indexOf(shouldRaise ? 'Raise' : 'Fold'),
      explanation: `${startingHandName(hole)} is around the top ${topPercent(percentile)}% of hands. A common guide from this seat is to play about the top ${topPercent(seat.top)}%.`,
    };
  }
}

function suitCounts(cards: readonly Card[]): number[] {
  const counts = [0, 0, 0, 0];
  for (const card of cards) counts[suitOf(card)]++;
  return counts;
}

function isFlushDraw(hole: readonly Card[], board: readonly Card[]): boolean {
  const counts = suitCounts([...hole, ...board]);
  return counts.some((count, suit) => count === 4 && hole.some((card) => suitOf(card) === suit));
}

/** Counts, by trying every unseen card, how many put the hero ahead. */
export function countOutsFor(
  hero: readonly Card[],
  villain: readonly Card[],
  board: readonly Card[],
): number {
  const seen = new Set<Card>([...hero, ...villain, ...board]);
  let outs = 0;
  for (const card of FULL_DECK) {
    if (seen.has(card)) continue;
    const next = [...board, card];
    if (bestRank(holdemNoLimit, hero, next) > bestRank(holdemNoLimit, villain, next)) outs++;
  }
  return outs;
}

export function countOuts(params: { flushDrawsOnly?: boolean }, rng: Rng): Draft {
  for (let tries = 0; ; tries++) {
    const deck = shuffle(FULL_DECK, rng);
    const hole = deck.slice(0, 2);
    const cards = deck.slice(2, 4);
    const board = deck.slice(4, 7);
    const heroRank = bestRank(holdemNoLimit, hole, board);
    const villainRank = bestRank(holdemNoLimit, cards, board);
    const relaxed = tries >= MAX_TRIES;

    if (!relaxed && heroRank >= villainRank) continue;
    if (!relaxed && params.flushDrawsOnly && !isFlushDraw(hole, board)) continue;
    const outs = countOutsFor(hole, cards, board);
    if (!relaxed && (outs < 4 || outs > 15)) continue;

    const { options, answer } = optionSet(
      String(outs),
      [outs + 1, outs + 2, outs + 4, outs - 1, outs - 2, outs - 3, outs * 2]
        .filter((value) => value > 0)
        .map(String),
      rng,
    );
    return {
      kind: 'choice',
      prompt:
        'The middle row is your opponent’s cards. How many {outs} put you ahead on the next card?',
      hole,
      cards,
      board,
      options,
      answer,
      explanation: `${outs} of the 45 unseen cards put you ahead. Right now you have ${describeHandMarked(heroRank)} against ${describeHandMarked(villainRank)}.`,
    };
  }
}

export function ruleOfTwoAndFour(_params: object, rng: Rng): Draft {
  const outs = pick([4, 6, 8, 9, 12, 15], rng);
  const onFlop = rng.nextInt(2) === 0;
  const multiplier = onFlop ? 4 : 2;
  const answer = outs * multiplier;
  const { options, answer: index } = optionSet(
    `${answer}%`,
    [outs * 2, outs * 4, outs * 3, outs, outs + 10].map((value) => `${value}%`),
    rng,
  );
  return {
    kind: 'choice',
    prompt: `You have ${outs} {outs} with ${onFlop ? 'two cards' : 'one card'} to come. Roughly what is your chance of hitting?`,
    options,
    answer: index,
    explanation: `A quick rule: multiply outs by ${multiplier} with ${onFlop ? 'two cards' : 'one card'} to come. ${outs} × ${multiplier} = ${answer}%.`,
  };
}

const BET_SIZES = [
  { name: 'a quarter of the pot', value: 1 / 4 },
  { name: 'half the pot', value: 1 / 2 },
  { name: 'three quarters of the pot', value: 3 / 4 },
  { name: 'the size of the pot', value: 1 },
];

function neededPercent(pot: number, bet: number): number {
  return Math.round((bet / (pot + 2 * bet)) * 100);
}

export function potOdds(_params: object, rng: Rng): Draft {
  const pot = pick([40, 80, 120, 160, 200], rng);
  const size = pick(BET_SIZES, rng);
  const bet = pot * size.value;
  const answer = neededPercent(pot, bet);
  const { options, answer: index } = optionSet(
    `${answer}%`,
    BET_SIZES.map((entry) => `${neededPercent(pot, pot * entry.value)}%`).concat('50%'),
    rng,
  );
  return {
    kind: 'choice',
    prompt: `The {pot} is ${pot} and your opponent bets ${bet}. What share of the pot do you need to win to {call}?`,
    options,
    answer: index,
    explanation: `You call ${bet} to win ${pot + bet}. ${bet} ÷ (${pot + bet} + ${bet}) is about ${answer}%. That is your {pot-odds|pot odds}.`,
  };
}

export function callOrFold(_params: object, rng: Rng): Draft {
  for (let tries = 0; ; tries++) {
    const pot = pick([60, 100, 150, 200], rng);
    const bet = Math.round(pot * pick([0.5, 0.75, 1], rng));
    const outs = pick([4, 8, 9, 12], rng);
    const onFlop = rng.nextInt(2) === 0;
    const chance = outs * (onFlop ? 4 : 2);
    const needed = neededPercent(pot, bet);
    if (Math.abs(chance - needed) < 5 && tries < MAX_TRIES) continue;

    const options = ['Call', 'Fold'];
    const shouldCall = chance >= needed;
    return {
      kind: 'choice',
      prompt: `The {pot} is ${pot} and you face a bet of ${bet}. You have ${outs} {outs} with ${onFlop ? 'two cards' : 'one card'} to come. {call|Call} or {fold}?`,
      options,
      answer: options.indexOf(shouldCall ? 'Call' : 'Fold'),
      explanation: `You need about ${needed}% and you have about ${chance}%, so ${shouldCall ? 'calling makes money over time' : 'folding is better'}.`,
    };
  }
}

export function flopSuits(_params: object, rng: Rng): Draft {
  const names = ['Monotone', 'Two-tone', 'Rainbow'];
  const target = pick(names, rng);

  for (let tries = 0; ; tries++) {
    const board = shuffle(FULL_DECK, rng).slice(0, 3);
    const suitTotal = new Set(board.map(suitOf)).size;
    if (names[suitTotal - 1] !== target && tries < MAX_TRIES) continue;

    return {
      kind: 'choice',
      prompt: 'How would you describe the suits on this {flop}?',
      board,
      options: names,
      answer: suitTotal - 1,
      explanation:
        suitTotal === 1
          ? 'All three cards share a suit, so the flop is {monotone}.'
          : suitTotal === 2
            ? 'Two cards share a suit, so the flop is {two-tone}.'
            : 'Three different suits make the flop {rainbow}.',
    };
  }
}

function classifyTexture(board: readonly Card[]): 'wet' | 'dry' | 'neither' {
  const ranks = board.map(rankOf).sort((a, b) => b - a);
  const suits = new Set(board.map(suitOf)).size;
  const paired = new Set(ranks).size < ranks.length;
  const span = ranks[0] - ranks[ranks.length - 1];

  if (!paired && span <= 4 && suits <= 2) return 'wet';
  const farApart = ranks[0] - ranks[1] >= 4 && ranks[1] - ranks[2] >= 4;
  if (suits === 3 && farApart) return 'dry';
  return 'neither';
}

export function wetOrDry(_params: object, rng: Rng): Draft {
  const target = pick(['wet', 'dry'] as const, rng);
  for (let tries = 0; ; tries++) {
    const board = shuffle(FULL_DECK, rng).slice(0, 3);
    if (classifyTexture(board) !== target && tries < MAX_TRIES) continue;

    const options = ['Wet', 'Dry'];
    const isWet = classifyTexture(board) === 'wet';
    return {
      kind: 'choice',
      prompt: 'Is this {flop} wet or dry?',
      board,
      options,
      answer: isWet ? 0 : 1,
      explanation: isWet
        ? 'The cards are close together and share suits, so many {draw|draws} are possible. That makes it a {wet-board|wet board}.'
        : 'The cards are far apart in different suits, so few {draw|draws} are possible. That makes it a {dry-board|dry board}.',
    };
  }
}

export function valueOrBluff(_params: object, rng: Rng): Draft {
  const wantValue = rng.nextInt(2) === 0;

  for (let tries = 0; ; tries++) {
    const deck = shuffle(FULL_DECK, rng);
    const hole = deck.slice(0, 2);
    const board = deck.slice(2, 7);
    const rank = bestRank(holdemNoLimit, hole, board);
    const category = categoryOf(rank);
    const usesHole = rank > rankFive(board);
    const isValue = category >= HandCategory.TwoPair && usesHole;
    const isBluff = category === HandCategory.HighCard;
    if ((wantValue ? !isValue : !isBluff) && tries < MAX_TRIES) continue;

    const options = ['Value bet', 'Bluff'];
    return {
      kind: 'choice',
      prompt: 'You bet on the {river} with this hand. Is it a {value-bet|value bet} or a {bluff}?',
      hole,
      board,
      options,
      answer: isValue ? 0 : 1,
      explanation: isValue
        ? `You have ${describeHandMarked(rank)}. Worse hands can {call}, so you are betting for value.`
        : `You only have ${describeHandMarked(rank)}. You need better hands to {fold}, so this is a bluff.`,
    };
  }
}

export function bankrollRule(_params: object, rng: Rng): Draft {
  const buyIns = 20;
  const answer = pick([25, 50, 100, 200, 500], rng);
  const bankroll = answer * buyIns;
  const { options, answer: index } = optionSet(
    String(answer),
    [answer * 2, answer * 4, Math.round(answer / 2), Math.round(bankroll / 10)].map(String),
    rng,
  );
  return {
    kind: 'choice',
    prompt: `A common rule is to keep at least ${buyIns} {buy-in|buy-ins} for your game. With a {bankroll} of ${bankroll}, what is the biggest buy-in you should play?`,
    options,
    answer: index,
    explanation: `${bankroll} ÷ ${buyIns} = ${answer}.`,
  };
}
