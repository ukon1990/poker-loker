import type { Exercise } from '@/curriculum/exercises';
import { type GeneratorId, generateExercise, type StepSpec } from '@/curriculum/generators';
import type { HandPair } from '@/curriculum/generators/hands';
import type { GenContext } from '@/curriculum/generators/shared';
import { LADDER, rungCategory } from '@/curriculum/ladder';
import { shuffle } from '@/engine/core/deck';
import { createRng, deriveSeed } from '@/engine/core/rng';
import { HandCategory as C } from '@/engine/eval/rank';
import type { VariantId } from '@/engine/variants/types';

export type UnitSuit = 'spade' | 'heart' | 'diamond' | 'club';

export interface Lesson {
  id: string;
  rank: string;
  title: string;
  steps: StepSpec[];
}

export interface Unit {
  id: string;
  title: string;
  suit: UnitSuit;
  lessons: Lesson[];
}

export interface Course {
  variantId: VariantId;
  units: Unit[];
}

function step<K extends GeneratorId>(
  gen: K,
  params: StepSpec<K>['params'],
  ...skills: string[]
): StepSpec {
  return { gen, params, skills } as StepSpec;
}

const word = (termId: string) => step('new-word', { termId });
const match = () => step('match-terms', {});
const sentence = () => step('complete-sentence', {});
const ladder = (prompt: string, intro: string, highlight: string[]) =>
  step('ladder', { prompt, intro, highlight });

const REVIEW_SHUFFLE = 0x72657669;
const REVIEW_RETRIES = 40;

const RANKINGS = 'hand-rankings';
const DECK = 'the-deck';
const CLOSE_CALLS = 'close-calls';
const HAND_ORDER = 'hand-order';
const COMPARING = 'comparing-hands';
const BOARD = 'reading-the-board';
const BEST5 = 'best-five';
const KICKERS = 'kickers';
const TIES = 'ties';
const FLOW = 'game-flow';
const ACTIONS = 'betting-actions';
const BLINDS = 'blinds';
const POT = 'pot-math';
const RAISES = 'minimum-raises';
const ALLIN = 'all-in';
const SIDE = 'side-pots';
const POSITION = 'position';
const STARTS = 'starting-hands';
const OUTS = 'outs';
const ODDS = 'pot-odds';
const TEXTURE = 'board-texture';
const VALUE = 'value-and-bluffs';
const MONEY = 'bankroll';
const TILT = 'tilt';
const SPOTS = 'playing-spots';

const LOWER = [C.HighCard, C.Pair, C.TwoPair];
const SMALL = [...LOWER, C.ThreeOfAKind];
const MIDDLE = [...SMALL, C.Straight, C.Flush];
const ALL = [...MIDDLE, C.FullHouse, C.FourOfAKind, C.StraightFlush];
const COMMON = [C.HighCard, C.Pair, C.TwoPair, C.ThreeOfAKind, C.Straight, C.Flush, C.FullHouse];

// Neighbours on the ladder, which are the hands people mix up.
const CLOSE_ALL: HandPair[] = [
  [C.Pair, C.TwoPair],
  [C.TwoPair, C.ThreeOfAKind],
  [C.ThreeOfAKind, C.Straight],
  [C.Straight, C.Flush],
  [C.Flush, C.FullHouse],
  [C.FullHouse, C.FourOfAKind],
  [C.FourOfAKind, C.StraightFlush],
];

const close = (first: (typeof C)[keyof typeof C], second: (typeof C)[keyof typeof C]) =>
  step('compare-hands', { pairs: [[first, second]] }, CLOSE_CALLS);

function unit(n: number, title: string, suit: UnitSuit, lessons: [string, StepSpec[]][]): Unit {
  const ranks = ['A', '2', '3', '4', '5'];
  return {
    id: `holdem-${n}`,
    title,
    suit,
    lessons: lessons.map(([lessonTitle, steps], index) => ({
      id: `holdem-${n}-${index + 1}`,
      rank: ranks[index],
      title: lessonTitle,
      steps,
    })),
  };
}

export const HOLDEM_COURSE: Course = {
  variantId: 'holdem-nl',
  units: [
    unit(1, 'Cards and hand rankings', 'spade', [
      [
        'Meet the deck',
        [
          word('rank'),
          step('higher-card', {}, DECK),
          step('higher-card', {}, DECK),
          word('suit'),
          step('deck-fact', {}, DECK),
          step('deck-fact', { fact: 'per-rank' }, DECK),
          word('hand'),
          match(),
        ],
      ],
      [
        'Small hands',
        [
          ladder(
            'Ten hands, one ladder',
            'Every hand has a place on this ladder and beats everything below it. Today you learn the four small hands.',
            ['high-card', 'pair', 'two-pair', 'three-of-a-kind'],
          ),
          word('high-card'),
          word('pair'),
          step(
            'name-hand',
            { categories: [C.HighCard, C.Pair], target: C.HighCard, tidy: true },
            RANKINGS,
          ),
          step(
            'name-hand',
            { categories: [C.HighCard, C.Pair], target: C.Pair, tidy: true },
            RANKINGS,
          ),
          word('two-pair'),
          step('name-hand', { categories: LOWER, target: C.TwoPair, tidy: true }, RANKINGS),
          step('worked-compare', { pair: [C.Pair, C.HighCard] }),
          step('compare-hands', { pairs: [[C.Pair, C.TwoPair]], showNames: true }, CLOSE_CALLS),
          word('three-of-a-kind'),
          step(
            'name-hand',
            { categories: [C.Pair, C.TwoPair, C.ThreeOfAKind], target: C.ThreeOfAKind, tidy: true },
            RANKINGS,
          ),
          close(C.TwoPair, C.ThreeOfAKind),
          step('name-hand', { categories: SMALL }, RANKINGS),
          match(),
        ],
      ],
      [
        'Strong hands',
        [
          step('ladder-next', { upTo: 'three-of-a-kind', direction: 'up' }, HAND_ORDER),
          ladder(
            'Three strong hands',
            'Today you meet the straight, the flush and the full house. Each step up is a rarer hand, and that is why it wins.',
            ['straight', 'flush', 'full-house'],
          ),
          word('straight'),
          step(
            'name-hand',
            {
              categories: [C.ThreeOfAKind, C.Straight, C.HighCard],
              target: C.Straight,
              tidy: true,
            },
            RANKINGS,
          ),
          word('wheel'),
          step('concept', { id: 'ace-low' }, RANKINGS),
          word('flush'),
          step(
            'name-hand',
            { categories: [C.Straight, C.Flush, C.Pair], target: C.Flush, tidy: true },
            RANKINGS,
          ),
          step('look-alike', { family: 'run', target: 'flush' }, RANKINGS),
          close(C.ThreeOfAKind, C.Straight),
          step('concept', { id: 'why-flush-beats-straight' }, RANKINGS),
          close(C.Straight, C.Flush),
          word('full-house'),
          step(
            'name-hand',
            {
              categories: [C.ThreeOfAKind, C.TwoPair, C.FullHouse],
              target: C.FullHouse,
              tidy: true,
            },
            RANKINGS,
          ),
          close(C.Flush, C.FullHouse),
          match(),
        ],
      ],
      [
        'Monsters',
        [
          step('ladder-next', { upTo: 'full-house' }, HAND_ORDER),
          ladder(
            'The top of the ladder',
            'These are the strongest hands in the game. Notice that five of a kind is not here.',
            ['four-of-a-kind', 'straight-flush', 'royal-flush'],
          ),
          word('four-of-a-kind'),
          word('quads'),
          step(
            'name-hand',
            {
              categories: [C.FullHouse, C.FourOfAKind, C.ThreeOfAKind],
              target: C.FourOfAKind,
              tidy: true,
            },
            RANKINGS,
          ),
          step('look-alike', { family: 'matching', target: 'full-house' }, RANKINGS),
          word('straight-flush'),
          word('royal-flush'),
          step(
            'name-hand',
            {
              categories: [C.Straight, C.Flush, C.StraightFlush],
              target: C.StraightFlush,
              tidy: true,
            },
            RANKINGS,
          ),
          step('look-alike', { family: 'royal', target: 'royal-flush' }, RANKINGS),
          step('concept', { id: 'royal-is-straight-flush' }, RANKINGS),
          step('look-alike', { family: 'royal', target: 'flush' }, RANKINGS),
          close(C.FullHouse, C.FourOfAKind),
          close(C.FourOfAKind, C.StraightFlush),
          step('concept', { id: 'five-of-a-kind' }, RANKINGS),
          match(),
        ],
      ],
      [
        'Rank them all',
        [
          step('ladder-next', { direction: 'up' }, HAND_ORDER),
          step('ladder-next', { direction: 'down' }, HAND_ORDER),
          step('order-names', { count: 4 }, HAND_ORDER),
          ladder(
            'The whole ladder',
            'Matching ranks climb: 2, 2 + 2, 3, 3 + 2, 4. A straight and a flush fit between 3 and 3 + 2. A straight flush is both.',
            [],
          ),
          step('concept', { id: 'matching-climb' }, HAND_ORDER),
          step('order-hands', { categories: ALL, count: 4 }, RANKINGS),
          step('worked-compare', { pair: [C.Pair, C.Pair] }),
          step('compare-same', { categories: [C.Pair, C.TwoPair] }, COMPARING),
          step('compare-same', { categories: [C.Flush] }, COMPARING),
          step('compare-same', { categories: [C.FullHouse] }, COMPARING),
          close(C.Straight, C.Flush),
          close(C.Flush, C.FullHouse),
          step('name-hand', { categories: ALL }, RANKINGS),
          step('order-names', { count: 6 }, HAND_ORDER),
          step('order-names', { count: 10 }, HAND_ORDER),
          match(),
        ],
      ],
    ]),
    unit(2, 'Reading the board', 'heart', [
      [
        'Best five of seven',
        [
          word('hole-cards'),
          word('community-cards'),
          word('board'),
          step('worked-best-five', { categories: [C.Flush, C.Straight] }),
          step('best-five', { categories: [C.Straight, C.Flush] }, BEST5),
          word('flop'),
          word('turn'),
          word('river'),
          word('street'),
          step('street-fact', {}, FLOW),
          step('street-fact', {}, FLOW),
          step('best-five', { categories: [C.FullHouse, C.Straight, C.Flush] }, BEST5),
          step('name-seven', { categories: COMMON }, BOARD),
          step('ladder-next', {}, HAND_ORDER),
          match(),
          sentence(),
        ],
      ],
      [
        'Kickers',
        [
          step('compare-same', { categories: [C.ThreeOfAKind, C.Straight] }, COMPARING),
          word('kicker'),
          step('worked-kicker', {}),
          step('board-compare', { pattern: 'kicker' }, KICKERS),
          step('board-compare', { pattern: 'kicker' }, KICKERS),
          step('best-five', { categories: LOWER }, BEST5),
          step('board-compare', { winner: [C.ThreeOfAKind], loser: [C.TwoPair] }, COMPARING),
          step('board-compare', { winner: [C.TwoPair], loser: [C.Pair] }, COMPARING),
          step('board-compare', { pattern: 'kicker' }, KICKERS),
          match(),
        ],
      ],
      [
        'Straights, flushes, full houses',
        [
          word('nuts'),
          step('board-compare', { winner: [C.Straight, C.Flush], loser: LOWER }, COMPARING),
          step('best-five', { categories: [C.Straight, C.Flush] }, BEST5),
          step('board-compare', { winner: [C.Flush], loser: [C.Straight] }, CLOSE_CALLS),
          step('board-compare', { winner: [C.FullHouse], loser: MIDDLE }, COMPARING),
          step('best-five', { categories: [C.FullHouse, C.Flush] }, BEST5),
          step('name-seven', { categories: COMMON }, BOARD),
          match(),
        ],
      ],
      [
        'Ties and split pots',
        [
          word('split-pot'),
          step('board-compare', { pattern: 'board-plays', offerSplit: true }, TIES),
          step('board-compare', { pattern: 'tie', offerSplit: true }, TIES),
          word('chop'),
          step('board-compare', { pattern: 'kicker', offerSplit: true }, TIES),
          step('board-compare', { pattern: 'tie', offerSplit: true }, TIES),
          step('concept', { id: 'what-beats-suit' }, TIES),
          step('board-compare', { pattern: 'any', offerSplit: true }, COMPARING),
          match(),
        ],
      ],
      [
        'Read them all',
        [
          word('trips'),
          word('set'),
          step('ladder-next', {}, HAND_ORDER),
          step('look-alike', { family: 'matching', target: 'three-of-a-kind' }, RANKINGS),
          step('board-compare', {}, COMPARING),
          step('best-five', { categories: COMMON }, BEST5),
          step('name-seven', { categories: COMMON }, BOARD),
          step('board-compare', { pattern: 'kicker' }, KICKERS),
          step('board-compare', { offerSplit: true }, COMPARING),
          step('best-five', { categories: ALL }, BEST5),
          match(),
          sentence(),
        ],
      ],
    ]),
    unit(3, 'Betting', 'diamond', [
      [
        'Blinds and rounds',
        [
          word('blind'),
          word('small-blind'),
          word('big-blind'),
          word('button'),
          step('seat-role', { roles: ['small-blind'] }, BLINDS),
          step('seat-role', { roles: ['big-blind'] }, BLINDS),
          word('pre-flop'),
          word('pot'),
          word('showdown'),
          step('street-fact', {}, FLOW),
          step('seat-role', { roles: ['small-blind', 'big-blind'] }, BLINDS),
          match(),
        ],
      ],
      [
        'Fold, call, raise',
        [
          word('check'),
          word('bet'),
          step('action-name', {}, ACTIONS),
          word('call'),
          word('raise'),
          word('fold'),
          step('action-name', {}, ACTIONS),
          step('illegal-action', {}, ACTIONS),
          step('pot-after-call', {}, POT),
          step('amount-to-call', {}, POT),
          step('action-name', {}, ACTIONS),
          match(),
          sentence(),
        ],
      ],
      [
        'How much to bet',
        [
          word('no-limit'),
          word('re-raise'),
          word('min-raise'),
          step('min-raise', {}, RAISES),
          step('bet-fraction', {}, POT),
          step('pot-after-call', {}, POT),
          step('min-raise', {}, RAISES),
          step('bet-fraction', {}, POT),
          step('amount-to-call', {}, POT),
          match(),
        ],
      ],
      [
        'All-in',
        [
          word('stack'),
          word('all-in'),
          word('buy-in'),
          step('all-in-call', {}, ALLIN),
          step('amount-to-call', {}, POT),
          step('all-in-call', {}, ALLIN),
          step('pot-after-call', {}, POT),
          match(),
          sentence(),
        ],
      ],
      [
        'Side pots',
        [
          word('main-pot'),
          word('side-pot'),
          step('side-pot', { ask: 'main' }, SIDE),
          step('side-pot', { ask: 'who' }, SIDE),
          step('side-pot', { ask: 'side' }, SIDE),
          step('all-in-call', {}, ALLIN),
          step('side-pot', { ask: 'side' }, SIDE),
          step('side-pot', { ask: 'main' }, SIDE),
          match(),
        ],
      ],
    ]),
    unit(4, 'Position', 'club', [
      [
        'Why seats matter',
        [
          word('position'),
          step('concept', { id: 'why-position' }, POSITION),
          step('seat-role', { roles: ['last-postflop'] }, POSITION),
          step('seat-role', { roles: ['first-postflop'] }, POSITION),
          step('seat-role', { roles: ['first-postflop', 'last-postflop'] }, POSITION),
          match(),
        ],
      ],
      [
        'Seat names',
        [
          word('under-the-gun'),
          step('seat-role', { roles: ['under-the-gun'] }, POSITION),
          word('cutoff'),
          step('seat-role', { roles: ['cutoff'] }, POSITION),
          word('hijack'),
          step('seat-role', { roles: ['hijack', 'cutoff'] }, POSITION),
          word('lojack'),
          word('middle-position'),
          step('seat-role', { roles: ['under-the-gun', 'hijack', 'cutoff'] }, POSITION),
          match(),
        ],
      ],
      [
        'Who acts when',
        [
          word('early-position'),
          word('late-position'),
          step('seat-role', { roles: ['first-preflop'] }, POSITION),
          step('seat-role', { roles: ['first-postflop'] }, POSITION),
          step(
            'seat-role',
            { roles: ['first-preflop', 'first-postflop', 'last-postflop'] },
            POSITION,
          ),
          step('seat-role', { roles: ['big-blind', 'under-the-gun', 'cutoff'] }, POSITION),
          match(),
        ],
      ],
      [
        'In position',
        [
          word('in-position'),
          word('out-of-position'),
          step('concept', { id: 'why-position' }, POSITION),
          step('seat-role', { roles: ['last-postflop'] }, POSITION),
          step('seat-role', { roles: ['first-postflop', 'last-postflop', 'cutoff'] }, POSITION),
          match(),
          sentence(),
        ],
      ],
      [
        'Position in practice',
        [
          word('limp'),
          word('three-bet'),
          step(
            'seat-role',
            { roles: ['under-the-gun', 'hijack', 'cutoff', 'small-blind', 'big-blind'] },
            POSITION,
          ),
          step(
            'seat-role',
            { roles: ['first-preflop', 'first-postflop', 'last-postflop'] },
            POSITION,
          ),
          step(
            'seat-role',
            { roles: ['under-the-gun', 'hijack', 'cutoff', 'small-blind', 'big-blind'] },
            POSITION,
          ),
          match(),
        ],
      ],
    ]),
    unit(5, 'Starting hands', 'spade', [
      [
        'Strong starts',
        [
          step('stronger-start', {}, STARTS),
          step('stronger-start', {}, STARTS),
          step('stronger-start', {}, STARTS),
          step('open-or-fold', { seats: ['button'] }, STARTS),
          step('stronger-start', {}, STARTS),
        ],
      ],
      [
        'Suited and connected',
        [
          word('suited'),
          word('connectors'),
          step('stronger-start', {}, STARTS),
          step('stronger-start', {}, STARTS),
          step('open-or-fold', { seats: ['button', 'cutoff'] }, STARTS),
          match(),
          sentence(),
        ],
      ],
      [
        'Early seats',
        [
          step('open-or-fold', { seats: ['under-the-gun'] }, STARTS),
          step('open-or-fold', { seats: ['under-the-gun'] }, STARTS),
          step('open-or-fold', { seats: ['hijack'] }, STARTS),
          step('open-or-fold', { seats: ['under-the-gun', 'hijack'] }, STARTS),
          step('open-or-fold', { seats: ['under-the-gun', 'hijack'] }, STARTS),
        ],
      ],
      [
        'Late seats',
        [
          step('open-or-fold', { seats: ['button'] }, STARTS),
          step('open-or-fold', { seats: ['cutoff'] }, STARTS),
          step('open-or-fold', { seats: ['button', 'cutoff'] }, STARTS),
          step('open-or-fold', { seats: ['button'] }, STARTS),
          step('open-or-fold', { seats: ['button', 'cutoff'] }, STARTS),
        ],
      ],
      [
        'Open or fold',
        [
          step('open-or-fold', { seats: ['under-the-gun', 'hijack', 'cutoff', 'button'] }, STARTS),
          step('open-or-fold', { seats: ['under-the-gun', 'hijack', 'cutoff', 'button'] }, STARTS),
          step('stronger-start', {}, STARTS),
          step('open-or-fold', { seats: ['under-the-gun', 'hijack', 'cutoff', 'button'] }, STARTS),
          step('open-or-fold', { seats: ['under-the-gun', 'hijack', 'cutoff', 'button'] }, STARTS),
          step('open-or-fold', { seats: ['under-the-gun', 'hijack', 'cutoff', 'button'] }, STARTS),
        ],
      ],
    ]),
    unit(6, 'Outs and pot odds', 'heart', [
      [
        'What are outs',
        [
          word('draw'),
          word('outs'),
          step('count-outs', {}, OUTS),
          step('count-outs', {}, OUTS),
          match(),
          sentence(),
        ],
      ],
      [
        'Count your outs',
        [
          word('flush-draw'),
          step('count-outs', { flushDrawsOnly: true }, OUTS),
          word('open-ended'),
          word('gutshot'),
          step('count-outs', {}, OUTS),
          step('count-outs', { flushDrawsOnly: true }, OUTS),
          step('count-outs', {}, OUTS),
          match(),
        ],
      ],
      [
        'Two and four',
        [
          word('equity'),
          step('rule-of-two-and-four', {}, OUTS),
          step('rule-of-two-and-four', {}, OUTS),
          step('count-outs', {}, OUTS),
          step('rule-of-two-and-four', {}, OUTS),
          match(),
        ],
      ],
      [
        'Pot odds',
        [
          word('pot-odds'),
          step('pot-odds', {}, ODDS),
          step('pot-odds', {}, ODDS),
          step('rule-of-two-and-four', {}, OUTS),
          step('pot-odds', {}, ODDS),
          step('pot-odds', {}, ODDS),
          match(),
        ],
      ],
      [
        'Call or fold',
        [
          word('implied-odds'),
          step('concept', { id: 'implied-odds' }, ODDS),
          step('call-or-fold', {}, ODDS),
          step('call-or-fold', {}, ODDS),
          step('pot-odds', {}, ODDS),
          step('call-or-fold', {}, ODDS),
          step('call-or-fold', {}, ODDS),
          step('play-spot', { decision: 'facing-bet', theme: 'draw' }, SPOTS),
          step('play-spot', { decision: 'facing-bet', theme: 'draw' }, SPOTS),
          match(),
        ],
      ],
    ]),
    unit(7, 'After the flop', 'diamond', [
      [
        'Board texture',
        [
          word('board-texture'),
          word('rainbow'),
          word('two-tone'),
          word('monotone'),
          step('flop-suits', {}, TEXTURE),
          step('flop-suits', {}, TEXTURE),
          word('wet-board'),
          word('dry-board'),
          step('wet-or-dry', {}, TEXTURE),
          step('wet-or-dry', {}, TEXTURE),
          match(),
        ],
      ],
      [
        'Value bets',
        [
          word('value-bet'),
          word('bluff'),
          word('range'),
          step('value-or-bluff', {}, VALUE),
          step('value-or-bluff', {}, VALUE),
          step('value-or-bluff', {}, VALUE),
          step('play-spot', { decision: 'checked-to', theme: 'made' }, SPOTS),
          step('play-spot', { decision: 'checked-to', theme: 'made' }, SPOTS),
          match(),
          sentence(),
        ],
      ],
      [
        'Bluffs',
        [
          word('semi-bluff'),
          step('concept', { id: 'semi-bluff' }, VALUE),
          step('value-or-bluff', {}, VALUE),
          step('value-or-bluff', {}, VALUE),
          step('value-or-bluff', {}, VALUE),
          step('play-spot', { decision: 'facing-bet', theme: 'weak' }, SPOTS),
          step('play-spot', { decision: 'facing-bet', theme: 'weak' }, SPOTS),
          match(),
        ],
      ],
      [
        'Continuation bets',
        [
          word('continuation-bet'),
          step('concept', { id: 'cbet-who' }, VALUE),
          step('concept', { id: 'cbet-board' }, VALUE),
          step('wet-or-dry', {}, TEXTURE),
          step('wet-or-dry', {}, TEXTURE),
          match(),
        ],
      ],
      [
        'Putting it together',
        [
          step('flop-suits', {}, TEXTURE),
          step('wet-or-dry', {}, TEXTURE),
          step('value-or-bluff', {}, VALUE),
          step('call-or-fold', {}, ODDS),
          step('count-outs', {}, OUTS),
          step('open-or-fold', { seats: ['under-the-gun', 'hijack', 'cutoff', 'button'] }, STARTS),
          step('value-or-bluff', {}, VALUE),
          step('call-or-fold', {}, ODDS),
          step('play-spot', {}, SPOTS),
          step('play-spot', {}, SPOTS),
          step('play-spot', {}, SPOTS),
        ],
      ],
    ]),
    unit(8, 'Bankroll and tilt', 'club', [
      [
        'Your bankroll',
        [
          word('bankroll'),
          step('concept', { id: 'bankroll-separate' }, MONEY),
          step('bankroll-rule', {}, MONEY),
          step('bankroll-rule', {}, MONEY),
          match(),
        ],
      ],
      [
        'Staying in your game',
        [
          word('ante'),
          step('bankroll-rule', {}, MONEY),
          step('bankroll-rule', {}, MONEY),
          step('concept', { id: 'bankroll-separate' }, MONEY),
          match(),
        ],
      ],
      [
        'Variance',
        [
          word('variance'),
          step('concept', { id: 'variance' }, TILT),
          step('concept', { id: 'good-habit' }, TILT),
          match(),
          sentence(),
        ],
      ],
      [
        'Tilt',
        [
          word('tilt'),
          step('concept', { id: 'tilt-sign' }, TILT),
          step('concept', { id: 'tilt-response' }, TILT),
          step('concept', { id: 'variance' }, TILT),
          match(),
        ],
      ],
      [
        'Good habits',
        [
          step('concept', { id: 'good-habit' }, TILT),
          step('concept', { id: 'tilt-response' }, TILT),
          step('bankroll-rule', {}, MONEY),
          step('concept', { id: 'tilt-sign' }, TILT),
          match(),
          sentence(),
        ],
      ],
    ]),
  ],
};

export function allLessons(course: Course): Lesson[] {
  return course.units.flatMap((entry) => entry.lessons);
}

export function findLesson(course: Course, lessonId: string): Lesson | undefined {
  return allLessons(course).find((lesson) => lesson.id === lessonId);
}

export function lessonTerms(lesson: Lesson): string[] {
  return lesson.steps.flatMap((entry) =>
    entry.gen === 'new-word' ? [(entry.params as { termId: string }).termId] : [],
  );
}

/** The words taught before a lesson, in course order. */
export function termsBefore(course: Course, lessonId: string): string[] {
  const lessons = allLessons(course);
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  return lessons.slice(0, index).flatMap(lessonTerms);
}

/** Every step gets new cards from `seed`, so no two play-throughs are the same. */
export function generateLesson(course: Course, lesson: Lesson, seed: number): Exercise[] {
  const context: GenContext = {
    knownTerms: termsBefore(course, lesson.id),
    lessonTerms: lessonTerms(lesson),
  };
  return lesson.steps.map((entry, index) =>
    generateExercise(entry, deriveSeed(seed, index), context),
  );
}

/** One drill for each skill, used by review sessions to deal new cards. */
export const SKILL_DRILLS: Record<string, StepSpec> = {
  [DECK]: step('deck-fact', {}, DECK),
  [RANKINGS]: step('order-hands', { categories: ALL, count: 3 }, RANKINGS),
  [CLOSE_CALLS]: step('compare-hands', { pairs: CLOSE_ALL }, CLOSE_CALLS),
  [HAND_ORDER]: step('order-names', { count: 5 }, HAND_ORDER),
  [COMPARING]: step('board-compare', {}, COMPARING),
  [BOARD]: step('name-seven', { categories: COMMON }, BOARD),
  [BEST5]: step('best-five', { categories: COMMON }, BEST5),
  [KICKERS]: step('board-compare', { pattern: 'kicker' }, KICKERS),
  [TIES]: step('board-compare', { pattern: 'tie', offerSplit: true }, TIES),
  [FLOW]: step('street-fact', {}, FLOW),
  [ACTIONS]: step('action-name', {}, ACTIONS),
  [BLINDS]: step('seat-role', { roles: ['small-blind', 'big-blind'] }, BLINDS),
  [POT]: step('pot-after-call', {}, POT),
  [RAISES]: step('min-raise', {}, RAISES),
  [ALLIN]: step('all-in-call', {}, ALLIN),
  [SIDE]: step('side-pot', { ask: 'side' }, SIDE),
  [POSITION]: step(
    'seat-role',
    { roles: ['first-preflop', 'first-postflop', 'last-postflop'] },
    POSITION,
  ),
  [STARTS]: step(
    'open-or-fold',
    { seats: ['under-the-gun', 'hijack', 'cutoff', 'button'] },
    STARTS,
  ),
  [OUTS]: step('count-outs', {}, OUTS),
  [ODDS]: step('pot-odds', {}, ODDS),
  [TEXTURE]: step('wet-or-dry', {}, TEXTURE),
  [VALUE]: step('value-or-bluff', {}, VALUE),
  [MONEY]: step('bankroll-rule', {}, MONEY),
  [TILT]: step('concept', { id: 'tilt-sign' }, TILT),
  [SPOTS]: step('play-spot', {}, SPOTS),
};

export const SKILL_NAMES: Record<string, string> = {
  [DECK]: 'The deck',
  [RANKINGS]: 'Hand rankings',
  [CLOSE_CALLS]: 'Close calls between hands',
  [HAND_ORDER]: 'Order of the hands',
  [COMPARING]: 'Comparing hands',
  [BOARD]: 'Reading the board',
  [BEST5]: 'Best five cards',
  [KICKERS]: 'Kickers',
  [TIES]: 'Ties and split pots',
  [FLOW]: 'Game flow',
  [ACTIONS]: 'Betting actions',
  [BLINDS]: 'Blinds',
  [POT]: 'Pot maths',
  [RAISES]: 'Minimum raises',
  [ALLIN]: 'All-in',
  [SIDE]: 'Side pots',
  [POSITION]: 'Position',
  [STARTS]: 'Starting hands',
  [OUTS]: 'Outs',
  [ODDS]: 'Pot odds',
  [TEXTURE]: 'Board texture',
  [VALUE]: 'Value bets and bluffs',
  [MONEY]: 'Bankroll',
  [TILT]: 'Tilt',
  [SPOTS]: 'Playing a spot',
};

/** What makes a question the same question, ignoring how its answers happen to be shuffled. */
function fingerprint(exercise: Exercise): string {
  return JSON.stringify(exercise, (key, value) =>
    key === 'options' || key === 'notes' || key === 'answer' ? undefined : value,
  );
}

/** Review questions drop the help they first came with, and range over everything taught. */
function forReview(spec: StepSpec, knownTerms: readonly string[]): StepSpec {
  const taught = LADDER.filter((rung) => knownTerms.includes(rung.termId));
  switch (spec.gen) {
    case 'compare-hands':
      return { ...spec, params: { ...spec.params, showNames: false } } as StepSpec;
    case 'name-hand': {
      const categories = [...new Set(taught.map(rungCategory))];
      return categories.length < 2 ? spec : ({ ...spec, params: { categories } } as StepSpec);
    }
    case 'ladder-next':
      return { ...spec, params: { upTo: taught.at(-1)?.termId } } as StepSpec;
    default:
      return spec;
  }
}

/** For a hand's own review: name that hand, with the other hands taught so far as options. */
function handTermDrill(termId: string, knownTerms: readonly string[]): StepSpec | undefined {
  const rung = LADDER.find((entry) => entry.termId === termId);
  // A word looked up at the table may not be taught yet, and then only its meaning is fair.
  if (!rung || termId === 'royal-flush' || !knownTerms.includes(termId)) return undefined;
  const target = rungCategory(rung);
  const others = LADDER.filter(
    (entry) =>
      entry !== rung && entry.termId !== 'royal-flush' && knownTerms.includes(entry.termId),
  ).map(rungCategory);
  return others.length === 0
    ? undefined
    : step('name-hand', { categories: [...others, target], target });
}

/**
 * A review session for these skills, with new cards each time. Questions come from the lessons
 * already finished, so review never asks about something that has not been taught.
 */
export function generateReview(
  skillIds: readonly string[],
  seed: number,
  knownTerms: readonly string[],
  completedLessons: readonly string[] = [],
): Exercise[] {
  const context: GenContext = { knownTerms, lessonTerms: [] };
  const rng = createRng(deriveSeed(seed, REVIEW_SHUFFLE));
  const finished = allLessons(HOLDEM_COURSE).filter((lesson) =>
    completedLessons.includes(lesson.id),
  );
  const taught = finished.flatMap((lesson) => lesson.steps);
  const decks = new Map<string, StepSpec[]>();
  const asked = new Set<string>();

  /** Deals out the steps for a skill without repeats, then starts over. */
  const nextTaught = (skillId: string): StepSpec | undefined => {
    let deck = decks.get(skillId);
    if (!deck || deck.length === 0) {
      deck = shuffle(
        taught.filter((entry) => entry.skills.includes(skillId)),
        rng,
      );
      decks.set(skillId, deck);
    }
    const next = deck.pop();
    return next && forReview(next, knownTerms);
  };

  return skillIds.flatMap((skillId, index) => {
    const spec: StepSpec | undefined = skillId.startsWith('term:')
      ? (handTermDrill(skillId.slice(5), knownTerms) ??
        step('term-meaning', { termId: skillId.slice(5) }))
      : (nextTaught(skillId) ??
        (completedLessons.length === 0 ? SKILL_DRILLS[skillId] : undefined));
    if (!spec) return [];

    let exercise = generateExercise(spec, deriveSeed(seed, index), context);
    for (let retry = 1; retry < REVIEW_RETRIES && asked.has(fingerprint(exercise)); retry++) {
      exercise = generateExercise(spec, deriveSeed(seed, index, retry), context);
    }
    asked.add(fingerprint(exercise));
    return [exercise];
  });
}
