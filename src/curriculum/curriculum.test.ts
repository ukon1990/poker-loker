import { describe, expect, it } from 'vitest';
import {
  allLessons,
  generateLesson,
  generateReview,
  HOLDEM_COURSE,
  lessonTerms,
  SKILL_DRILLS,
  SKILL_NAMES,
  termsBefore,
} from '@/curriculum/course';
import type { ChoiceExercise, Exercise } from '@/curriculum/exercises';
import { type GeneratorId, generateExercise, type StepSpec } from '@/curriculum/generators';
import { GLOSSARY, hasTerm } from '@/curriculum/glossary';
import { markedTerms, parseText, plainText } from '@/curriculum/text';
import { type Card, formatCard } from '@/engine/core/cards';
import { combinations } from '@/engine/core/combinations';
import { buildDeck, STANDARD_52 } from '@/engine/core/deck';
import { CATEGORY_NAMES } from '@/engine/eval/describe';
import { evaluateHand } from '@/engine/eval/evaluate';
import { categoryOf, HandCategory, rankFive } from '@/engine/eval/rank';
import { holdemNoLimit } from '@/engine/variants/holdem';

const SEEDS = 150;
const NO_CONTEXT = { knownTerms: GLOSSARY.map((term) => term.id), lessonTerms: [] };

function run<T extends Exercise = Exercise>(gen: GeneratorId, params: unknown, seed: number): T {
  return generateExercise({ gen, params, skills: ['test'] } as StepSpec, seed, NO_CONTEXT) as T;
}

function bestOfSeven(hole: readonly Card[], board: readonly Card[]): number {
  // Deliberately the slow, general path, so this does not repeat the code under test.
  return evaluateHand(holdemNoLimit, hole, board).rank;
}

function textOf(exercise: Exercise): string[] {
  if (exercise.kind === 'new-word' || exercise.kind === 'match') return [];
  return [exercise.prompt, exercise.explanation];
}

function numbersIn(text: string): number[] {
  return [...plainText(text).matchAll(/\d+/g)].map((match) => Number(match[0]));
}

const correctOption = (exercise: ChoiceExercise) => exercise.options[exercise.answer];

describe('text marks', () => {
  it('splits plain text and terms', () => {
    expect(parseText('Your {flush} or {call|calling}.')).toEqual([
      { type: 'text', text: 'Your ' },
      { type: 'term', id: 'flush', text: 'flush' },
      { type: 'text', text: ' or ' },
      { type: 'term', id: 'call', text: 'calling' },
      { type: 'text', text: '.' },
    ]);
  });

  it('removes marks for plain text', () => {
    expect(plainText('A {call|calling} {flush}')).toBe('A calling flush');
  });
});

describe('glossary', () => {
  it('has unique ids', () => {
    expect(new Set(GLOSSARY.map((term) => term.id)).size).toBe(GLOSSARY.length);
  });

  it('links only to terms that exist', () => {
    for (const term of GLOSSARY) {
      for (const id of markedTerms(term.long)) expect(hasTerm(id), `${term.id} → ${id}`).toBe(true);
    }
  });

  it('teaches every term exactly once', () => {
    const taught = allLessons(HOLDEM_COURSE).flatMap(lessonTerms);
    expect(taught.filter((id, index) => taught.indexOf(id) !== index)).toEqual([]);
    expect(GLOSSARY.map((term) => term.id).filter((id) => !taught.includes(id))).toEqual([]);
    for (const id of taught) expect(hasTerm(id), id).toBe(true);
  });
});

describe('course', () => {
  it('has eight units of five lessons, with unique ids', () => {
    expect(HOLDEM_COURSE.units).toHaveLength(8);
    for (const unit of HOLDEM_COURSE.units) expect(unit.lessons).toHaveLength(5);
    const ids = allLessons(HOLDEM_COURSE).map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(40);
  });

  it('has a drill and a name for every skill it practises', () => {
    const skills = allLessons(HOLDEM_COURSE).flatMap((lesson) =>
      lesson.steps.flatMap((step) => step.skills),
    );
    for (const skill of new Set(skills)) {
      expect(SKILL_DRILLS[skill], skill).toBeDefined();
      expect(SKILL_NAMES[skill], skill).toBeDefined();
    }
  });

  it('generates every lesson validly, only using words taught by that point', () => {
    for (const lesson of allLessons(HOLDEM_COURSE)) {
      const allowed = new Set([...termsBefore(HOLDEM_COURSE, lesson.id), ...lessonTerms(lesson)]);

      for (let seed = 0; seed < 40; seed++) {
        for (const exercise of generateLesson(HOLDEM_COURSE, lesson, seed)) {
          for (const text of textOf(exercise)) {
            for (const id of markedTerms(text)) {
              expect(hasTerm(id), `${lesson.id}: ${id}`).toBe(true);
              expect(allowed.has(id), `${lesson.id} uses "${id}" before teaching it: ${text}`).toBe(
                true,
              );
            }
          }
          if (exercise.kind === 'choice') {
            expect(exercise.answer).toBeGreaterThanOrEqual(0);
            expect(exercise.answer).toBeLessThan(exercise.options.length);
            expect(exercise.options.length).toBeGreaterThanOrEqual(2);
            expect(new Set(exercise.options).size, exercise.prompt).toBe(exercise.options.length);
          }
          if (exercise.kind === 'match') {
            expect(exercise.terms.length).toBeGreaterThanOrEqual(2);
          }
        }
      }
    }
  });

  it('deals different cards on each play-through, and the same for the same seed', () => {
    const lesson = allLessons(HOLDEM_COURSE)[6];
    const render = (seed: number) => JSON.stringify(generateLesson(HOLDEM_COURSE, lesson, seed));

    expect(render(1)).toBe(render(1));
    expect(render(1)).not.toBe(render(2));
  });

  it('builds a review from any mix of skills and terms', () => {
    const skills = [...Object.keys(SKILL_DRILLS), 'term:flop', 'term:outs'];
    const exercises = generateReview(skills, 3, ['flop', 'outs', 'turn', 'river']);
    expect(exercises).toHaveLength(skills.length);
  });
});

describe('answers are correct', () => {
  it('compares hands sharing a board, for every pattern', () => {
    const patterns = [
      {},
      { pattern: 'kicker', offerSplit: true },
      { pattern: 'tie', offerSplit: true },
      { pattern: 'board-plays', offerSplit: true },
      { winner: [HandCategory.ThreeOfAKind], loser: [HandCategory.TwoPair] },
    ];

    for (const params of patterns) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const exercise = run<Extract<Exercise, { kind: 'compare' }>>('board-compare', params, seed);
        const [a, b] = exercise.hands;
        const rankA = bestOfSeven(a.cards, exercise.board);
        const rankB = bestOfSeven(b.cards, exercise.board);
        const expected = rankA === rankB ? 2 : rankA > rankB ? 0 : 1;

        expect(exercise.answer).toBe(expected);
        expect(a.result).toBe(CATEGORY_NAMES[categoryOf(rankA)]);
        expect(b.result).toBe(CATEGORY_NAMES[categoryOf(rankB)]);

        const all = [...exercise.board, ...a.cards, ...b.cards];
        expect(new Set(all).size).toBe(all.length);
      }
    }
  });

  it('honours requested patterns', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const tie = run<Extract<Exercise, { kind: 'compare' }>>(
        'board-compare',
        { pattern: 'tie', offerSplit: true },
        seed,
      );
      expect(tie.answer).toBe(2);

      const plays = run<Extract<Exercise, { kind: 'compare' }>>(
        'board-compare',
        { pattern: 'board-plays', offerSplit: true },
        seed,
      );
      expect(plays.answer).toBe(2);
      expect(categoryOf(rankFive(plays.board))).toBe(HandCategory.Straight);

      const kicker = run<Extract<Exercise, { kind: 'compare' }>>(
        'board-compare',
        { pattern: 'kicker' },
        seed,
      );
      expect(kicker.answer).not.toBe(2);
      expect(kicker.hands[0].result).toBe(kicker.hands[1].result);
      expect(kicker.explanation).toContain('{kicker}');
    }
  });

  it('honours requested winning and losing hands', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<Extract<Exercise, { kind: 'compare' }>>(
        'board-compare',
        { winner: [HandCategory.ThreeOfAKind], loser: [HandCategory.TwoPair] },
        seed,
      );
      expect(exercise.hands.map((hand) => hand.result).sort()).toEqual([
        'Three of a kind',
        'Two pair',
      ]);
    }
  });

  it('names five-card hands, including rare ones', () => {
    const categories = Object.values(HandCategory);
    const seen = new Set<string>();
    for (let seed = 0; seed < 600; seed++) {
      const exercise = run<ChoiceExercise>('name-hand', { categories }, seed);
      const expected = CATEGORY_NAMES[categoryOf(rankFive(exercise.cards as Card[]))];
      expect(correctOption(exercise)).toBe(expected);
      seen.add(expected);
    }
    expect(seen.size).toBe(9);
  });

  it('accepts exactly the best five cards', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<Extract<Exercise, { kind: 'best-five' }>>(
        'best-five',
        { categories: Object.values(HandCategory) },
        seed,
      );
      const all = [...exercise.hole, ...exercise.board];
      const best = Math.max(...combinations(all, 5).map(rankFive));
      expect(exercise.bestRank).toBe(best);
    }
  });

  it('orders hands strongest first', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<Extract<Exercise, { kind: 'order' }>>(
        'order-hands',
        { categories: Object.values(HandCategory), count: 4 },
        seed,
      );
      const ranks = exercise.order.map((index) => rankFive(exercise.hands[index].cards));
      expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
      const cards = exercise.hands.flatMap((hand) => hand.cards);
      expect(new Set(cards).size).toBe(cards.length);
    }
  });

  it('works out seats by clockwise position from the button', () => {
    const expected: Record<string, (button: number, seats: number) => number> = {
      'small-blind': (b, n) => (b + 1) % n,
      'big-blind': (b, n) => (b + 2) % n,
      'first-preflop': (b, n) => (b + 3) % n,
      'under-the-gun': (b, n) => (b + 3) % n,
      'first-postflop': (b, n) => (b + 1) % n,
      'last-postflop': (b) => b,
      cutoff: (b, n) => (b - 1 + n) % n,
      hijack: (b, n) => (b - 2 + n) % n,
    };

    for (const [role, seatFor] of Object.entries(expected)) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const exercise = run<Extract<Exercise, { kind: 'seat' }>>(
          'seat-role',
          { roles: [role] },
          seed,
        );
        expect(exercise.answerSeat, role).toBe(seatFor(exercise.buttonSeat, exercise.seatCount));
      }
    }
  });

  it('adds up the pot', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('pot-after-call', {}, seed);
      const [pot, bet] = numbersIn(exercise.prompt);
      expect(correctOption(exercise)).toBe(String(pot + 2 * bet));
    }
  });

  it('works out the amount to call', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('amount-to-call', {}, seed);
      const [blind, raiseTo] = numbersIn(exercise.prompt);
      expect(correctOption(exercise)).toBe(String(raiseTo - blind));
    }
  });

  it('works out the minimum raise', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('min-raise', {}, seed);
      const raiseTo = numbersIn(exercise.prompt)[2];
      expect(correctOption(exercise)).toBe(String(raiseTo + (raiseTo - 10)));
    }
  });

  it('works out main and side pots', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const main = run<ChoiceExercise>('side-pot', { ask: 'main' }, seed);
      const [short] = numbersIn(main.prompt);
      expect(correctOption(main)).toBe(String(3 * short));

      const side = run<ChoiceExercise>('side-pot', { ask: 'side' }, seed);
      const [shortSide, big] = numbersIn(side.prompt);
      expect(correctOption(side)).toBe(String(2 * (big - shortSide)));
    }
  });

  it('counts outs by checking every unseen card', () => {
    const fullDeck = buildDeck(STANDARD_52);
    for (let seed = 0; seed < 60; seed++) {
      const exercise = run<ChoiceExercise>('count-outs', {}, seed);
      const hole = exercise.hole as Card[];
      const villain = exercise.cards as Card[];
      const board = exercise.board as Card[];
      const seen = new Set([...hole, ...villain, ...board]);

      let outs = 0;
      for (const card of fullDeck) {
        if (seen.has(card)) continue;
        const next = [...board, card];
        if (bestOfSeven(hole, next) > bestOfSeven(villain, next)) outs++;
      }
      expect(correctOption(exercise)).toBe(String(outs));
    }
  });

  it('works out pot odds', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('pot-odds', {}, seed);
      const [pot, bet] = numbersIn(exercise.prompt);
      expect(correctOption(exercise)).toBe(`${Math.round((bet / (pot + 2 * bet)) * 100)}%`);
    }
  });

  it('compares your chance with the price', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('call-or-fold', {}, seed);
      const [pot, bet, outs] = numbersIn(exercise.prompt);
      const chance = outs * (plainText(exercise.prompt).includes('two cards') ? 4 : 2);
      const needed = Math.round((bet / (pot + 2 * bet)) * 100);
      expect(correctOption(exercise)).toBe(chance >= needed ? 'Call' : 'Fold');
    }
  });

  it('describes flop suits', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('flop-suits', {}, seed);
      const suits = new Set((exercise.board as Card[]).map((card) => formatCard(card)[1])).size;
      expect(correctOption(exercise)).toBe(['Monotone', 'Two-tone', 'Rainbow'][suits - 1]);
    }
  });

  it('grades spots by comparing the chance of winning with the price', () => {
    type Spot = Extract<Exercise, { kind: 'spot' }>;
    const variations = [
      {},
      { decision: 'facing-bet', theme: 'draw' },
      { decision: 'checked-to', theme: 'made' },
      { decision: 'facing-bet', theme: 'weak' },
    ];

    for (const params of variations) {
      for (let seed = 0; seed < 60; seed++) {
        const exercise = run<Spot>('play-spot', params, seed);
        const cards = [...exercise.hole, ...exercise.board];
        expect(new Set(cards).size).toBe(cards.length);
        expect([3, 4, 5]).toContain(exercise.board.length);

        if (exercise.needed !== null) {
          const call = Number(exercise.options[1].replace('Call ', ''));
          expect(exercise.needed).toBeCloseTo(call / (exercise.pot + call), 5);
          expect(exercise.answer).toBe(exercise.equity >= exercise.needed ? 1 : 0);
          expect(Math.abs(exercise.equity - exercise.needed)).toBeGreaterThanOrEqual(0.1);
          expect(exercise.history.at(-1)).toContain(`bets ${call}`);
        } else {
          expect(exercise.options).toEqual(['Check', 'Bet']);
          expect(exercise.answer).toBe(exercise.equity >= 0.5 ? 1 : 0);
          expect(exercise.equity >= 0.62 || exercise.equity <= 0.38).toBe(true);
        }
      }
    }
  });

  it('builds spots that match their theme', () => {
    type Spot = Extract<Exercise, { kind: 'spot' }>;
    for (let seed = 0; seed < 60; seed++) {
      const weak = run<Spot>('play-spot', { decision: 'facing-bet', theme: 'weak' }, seed);
      expect(categoryOf(bestOfSeven(weak.hole, weak.board))).toBe(HandCategory.HighCard);
      expect(weak.options[weak.answer]).toBe('Fold');

      const draw = run<Spot>('play-spot', { decision: 'facing-bet', theme: 'draw' }, seed);
      expect(draw.explanation).toContain('complete your');
    }
  });

  it('applies the bankroll rule', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('bankroll-rule', {}, seed);
      const [buyIns, bankroll] = numbersIn(exercise.prompt);
      expect(correctOption(exercise)).toBe(String(bankroll / buyIns));
    }
  });
});
