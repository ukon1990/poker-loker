import type { Exercise } from '@/curriculum/exercises';
import { type GeneratorId, generateExercise, type StepSpec } from '@/curriculum/generators';
import type { GenContext } from '@/curriculum/generators/shared';
import { deriveSeed } from '@/engine/core/rng';
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

const RANKINGS = 'hand-rankings';
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

const LOWER = [C.HighCard, C.Pair, C.TwoPair];
const MIDDLE = [...LOWER, C.ThreeOfAKind, C.Straight, C.Flush];
const ALL = [...MIDDLE, C.FullHouse, C.FourOfAKind, C.StraightFlush];
const COMMON = [C.HighCard, C.Pair, C.TwoPair, C.ThreeOfAKind, C.Straight, C.Flush, C.FullHouse];

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
          step('higher-card', {}, RANKINGS),
          step('higher-card', {}, RANKINGS),
          word('suit'),
          step('deck-fact', {}, RANKINGS),
          step('deck-fact', {}, RANKINGS),
          word('hand'),
          match(),
        ],
      ],
      [
        'High card, pair, two pair',
        [
          word('high-card'),
          word('pair'),
          step('name-hand', { categories: [C.HighCard, C.Pair] }, RANKINGS),
          word('two-pair'),
          step('name-hand', { categories: LOWER }, RANKINGS),
          step('compare-hands', { categories: LOWER }, COMPARING),
          step('compare-hands', { categories: LOWER }, COMPARING),
          match(),
        ],
      ],
      [
        'Three of a kind to flush',
        [
          word('three-of-a-kind'),
          step('name-hand', { categories: [C.TwoPair, C.ThreeOfAKind, C.Pair] }, RANKINGS),
          word('straight'),
          step('name-hand', { categories: [C.ThreeOfAKind, C.Straight, C.HighCard] }, RANKINGS),
          word('flush'),
          step('name-hand', { categories: MIDDLE }, RANKINGS),
          step('compare-hands', { categories: MIDDLE }, COMPARING),
          step('compare-hands', { categories: MIDDLE }, COMPARING),
          match(),
        ],
      ],
      [
        'Full house and up',
        [
          word('full-house'),
          step('name-hand', { categories: [C.ThreeOfAKind, C.TwoPair, C.FullHouse] }, RANKINGS),
          word('four-of-a-kind'),
          step('name-hand', { categories: [C.FullHouse, C.FourOfAKind, C.ThreeOfAKind] }, RANKINGS),
          word('straight-flush'),
          word('royal-flush'),
          step(
            'name-hand',
            { categories: [C.Straight, C.Flush, C.StraightFlush, C.FullHouse] },
            RANKINGS,
          ),
          step('compare-hands', { categories: ALL }, COMPARING),
          match(),
        ],
      ],
      [
        'Rank them all',
        [
          word('trips'),
          word('quads'),
          word('wheel'),
          step('order-hands', { categories: LOWER, count: 3 }, RANKINGS),
          step('order-hands', { categories: MIDDLE, count: 3 }, RANKINGS),
          step('order-hands', { categories: ALL, count: 4 }, RANKINGS),
          step('name-hand', { categories: ALL }, RANKINGS),
          step('compare-hands', { categories: ALL }, COMPARING),
          step('order-hands', { categories: ALL, count: 4 }, RANKINGS),
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
          word('flop'),
          word('turn'),
          word('river'),
          word('street'),
          step('street-fact', {}, FLOW),
          step('street-fact', {}, FLOW),
          step('best-five', { categories: LOWER }, BEST5),
          step('best-five', { categories: MIDDLE }, BEST5),
          step('name-seven', { categories: COMMON }, BOARD),
          match(),
          sentence(),
        ],
      ],
      [
        'Kickers',
        [
          word('kicker'),
          step('board-compare', { pattern: 'kicker' }, KICKERS),
          step('board-compare', { pattern: 'kicker' }, KICKERS),
          step('board-compare', { winner: [C.ThreeOfAKind], loser: [C.TwoPair] }, COMPARING),
          step('board-compare', { winner: [C.TwoPair], loser: [C.Pair] }, COMPARING),
          step('board-compare', { pattern: 'kicker' }, KICKERS),
          match(),
        ],
      ],
      [
        'The board plays',
        [
          word('nuts'),
          step('board-compare', { winner: [C.Straight, C.Flush], loser: LOWER }, COMPARING),
          step('best-five', { categories: [C.Straight, C.Flush] }, BEST5),
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
          word('set'),
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
  [RANKINGS]: step('order-hands', { categories: ALL, count: 3 }, RANKINGS),
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
};

export const SKILL_NAMES: Record<string, string> = {
  [RANKINGS]: 'Hand rankings',
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
};

/** A review session for these skills, with new cards each time. */
export function generateReview(
  skillIds: readonly string[],
  seed: number,
  knownTerms: readonly string[],
): Exercise[] {
  const context: GenContext = { knownTerms, lessonTerms: [] };

  return skillIds.flatMap((skillId, index) => {
    const spec: StepSpec | undefined = skillId.startsWith('term:')
      ? step('term-meaning', { termId: skillId.slice(5) })
      : SKILL_DRILLS[skillId];
    return spec ? [generateExercise(spec, deriveSeed(seed, index), context)] : [];
  });
}
