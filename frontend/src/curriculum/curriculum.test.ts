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
import { tidyHand } from '@/curriculum/generators/shared';
import { GLOSSARY, hasTerm } from '@/curriculum/glossary';
import {
  bestFiveMistake,
  LADDER,
  oneIn,
  orderMistake,
  type Rung,
  rungForTerm,
  rungOfRank,
  wrongNameNote,
} from '@/curriculum/ladder';
import { markedTerms, parseText, plainText } from '@/curriculum/text';
import { type Card, formatCard, cards as parseCards, rankOf } from '@/engine/core/cards';
import { combinations } from '@/engine/core/combinations';
import { buildDeck, STANDARD_52 } from '@/engine/core/deck';
import { explainWin, handName } from '@/engine/eval/describe';
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
  if (exercise.kind === 'ladder') return [exercise.prompt, exercise.intro];
  if (exercise.kind === 'worked') return [exercise.prompt, ...exercise.steps];
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

describe('hand ladder', () => {
  it('shows a sample of the right hand on every rung', () => {
    for (const rung of LADDER) expect(rungOfRank(rankFive(rung.sample)), rung.name).toBe(rung);
  });

  it('counts every possible five-card hand', () => {
    const counts = new Map(LADDER.map((rung) => [rung, 0]));
    for (const hand of combinations(buildDeck(STANDARD_52), 5)) {
      const rung = rungOfRank(rankFive(hand));
      counts.set(rung, (counts.get(rung) as number) + 1);
    }
    for (const rung of LADDER) expect(counts.get(rung), rung.name).toBe(rung.combos);
  });

  it('gets rarer on every step up', () => {
    LADDER.slice(1).forEach((rung, index) => {
      expect(rung.combos, rung.name).toBeLessThan(LADDER[index].combos);
    });
  });
});

describe('course', () => {
  it('puts every neighbouring close call in Unit 1, and the hardest two twice', () => {
    const counts = new Map<string, number>();
    for (const lesson of HOLDEM_COURSE.units[0].lessons) {
      for (const step of lesson.steps) {
        const params = step.params as { pairs?: readonly (readonly number[])[] };
        if (step.gen !== 'compare-hands' || !params.pairs) continue;
        expect(params.pairs, 'each step names one pair').toHaveLength(1);
        const key = [...params.pairs[0]].sort().join('-');
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const pair = (a: HandCategory, b: HandCategory) => [a, b].sort().join('-');
    const C = HandCategory;
    expect(counts.size).toBe(7);
    expect(counts.get(pair(C.Straight, C.Flush))).toBe(2);
    expect(counts.get(pair(C.Flush, C.FullHouse))).toBe(2);
    for (const [a, b] of [
      [C.Pair, C.TwoPair],
      [C.TwoPair, C.ThreeOfAKind],
      [C.ThreeOfAKind, C.Straight],
      [C.FullHouse, C.FourOfAKind],
      [C.FourOfAKind, C.StraightFlush],
    ] as const) {
      expect(counts.get(pair(a, b))).toBe(1);
    }
  });

  it('teaches one ladder group per lesson', () => {
    const [, small, strong, monsters] = HOLDEM_COURSE.units[0].lessons;
    const taught = (lesson: typeof small) =>
      lessonTerms(lesson).filter((id) => LADDER.some((rung) => rung.termId === id));
    const group = (name: string) =>
      LADDER.filter((rung) => rung.group === name).map((rung) => rung.termId);

    expect(taught(small).sort()).toEqual(group('small').sort());
    expect(taught(strong).sort()).toEqual(group('strong').sort());
    expect(taught(monsters).sort()).toEqual(group('monster').sort());
  });

  it('never shows more than four word cards in a row', () => {
    for (const lesson of allLessons(HOLDEM_COURSE)) {
      let run = 0;
      for (const step of lesson.steps) {
        run = step.gen === 'new-word' ? run + 1 : 0;
        expect(run, lesson.id).toBeLessThanOrEqual(4);
      }
    }
  });

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
          if (exercise.kind === 'ladder') {
            for (const id of exercise.highlight) {
              expect(
                LADDER.some((rung) => rung.termId === id),
                id,
              ).toBe(true);
            }
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

describe('review', () => {
  const firstLesson = ['holdem-1-1'];
  const unitOne = HOLDEM_COURSE.units[0].lessons.map((lesson) => lesson.id);

  it('only asks about lessons already finished', () => {
    const skills = Array<string>(40).fill('the-deck');
    for (const exercise of generateReview(skills, 5, [], firstLesson)) {
      expect(exercise.kind).toBe('choice');
      expect((exercise as ChoiceExercise).cards?.length ?? 2).toBeLessThanOrEqual(2);
    }
    expect(generateReview(['hand-rankings'], 5, [], firstLesson)).toEqual([]);
  });

  it('asks naming questions across every hand taught, not one fixed hand', () => {
    const known = HOLDEM_COURSE.units[0].lessons.flatMap(lessonTerms);
    const named = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      for (const exercise of generateReview(Array(4).fill('hand-rankings'), seed, known, unitOne)) {
        if (exercise.kind !== 'choice' || !exercise.prompt.startsWith('What hand')) continue;
        expect(exercise.options.length).toBeGreaterThanOrEqual(4);
        named.add(handName(rankFive(exercise.cards as Card[])));
      }
    }
    expect(named.size).toBeGreaterThanOrEqual(9);
  });

  it('keeps next-step questions to the hands taught so far', () => {
    const lessons = ['holdem-1-1', 'holdem-1-2', 'holdem-1-3'];
    const known = HOLDEM_COURSE.units[0].lessons.slice(0, 3).flatMap(lessonTerms);
    const allowed = LADDER.filter((rung) => known.includes(rung.termId)).map((rung) => rung.name);
    for (let seed = 0; seed < 200; seed++) {
      const [exercise] = generateReview(['hand-order'], seed, known, lessons) as ChoiceExercise[];
      for (const option of exercise.options) expect(allowed).toContain(option);
    }
  });

  it('does not ask the same question twice in a session while others remain', () => {
    const lessons = ['holdem-1-1', 'holdem-1-2', 'holdem-1-3'];
    const known = HOLDEM_COURSE.units[0].lessons.slice(0, 3).flatMap(lessonTerms);
    for (let seed = 0; seed < 300; seed++) {
      const prompts = generateReview(Array(8).fill('hand-order'), seed, known, lessons).map(
        (exercise) => (exercise as ChoiceExercise).prompt,
      );
      expect(new Set(prompts).size, `seed ${seed}`).toBe(prompts.length);
    }
  });

  it('falls back to the meaning of a hand looked up before it is taught', () => {
    const [exercise] = generateReview(['term:flush'], 1, ['pair', 'high-card']) as ChoiceExercise[];
    expect(exercise.prompt).toContain('Flush');
    expect(exercise.cards).toBeUndefined();
  });

  it('mixes the question types taught for a skill, without repeating until it runs out', () => {
    const exercises = generateReview(Array<string>(12).fill('hand-rankings'), 5, [], unitOne);
    expect(new Set(exercises.map((exercise) => exercise.kind)).size).toBeGreaterThan(1);
    const prompts = exercises
      .filter((exercise) => exercise.kind === 'choice')
      .map((exercise) => (exercise as ChoiceExercise).prompt)
      .filter((prompt) => prompt.startsWith('Why does') || prompt.startsWith('Can you make'));
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it('drops the help that a question first came with', () => {
    for (const exercise of generateReview(Array<string>(20).fill('close-calls'), 7, [], unitOne)) {
      if (exercise.kind === 'compare') expect(exercise.showNames).toBeFalsy();
    }
  });

  it('falls back to the standard drill when nothing has been finished', () => {
    expect(generateReview(['close-calls'], 1, [])).toHaveLength(1);
  });

  it('reviews a hand by asking the learner to name that hand', () => {
    const known = ['pair', 'straight', 'flush'];
    for (let seed = 0; seed < 40; seed++) {
      const [exercise] = generateReview(['term:flush'], seed, known) as ChoiceExercise[];
      expect(handName(rankFive(exercise.cards as Card[]))).toBe('Flush');
      expect(exercise.skills).toEqual(['term:flush']);
    }
  });

  it('keeps asking the meaning for words that are not hands', () => {
    const [exercise] = generateReview(['term:flop'], 1, ['flop']) as ChoiceExercise[];
    expect(exercise.prompt).toContain('Flop');
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
        expect(a.result).toBe(handName(rankA));
        expect(b.result).toBe(handName(rankB));

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
      const expected = handName(rankFive(exercise.cards as Card[]));
      expect(correctOption(exercise)).toBe(expected);
      if (expected === 'Royal flush') expect(exercise.options).not.toContain('Straight flush');
      seen.add(expected);
    }
    expect(seen.size).toBe(10);
  });

  it('knows there are four cards of each rank', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      expect(correctOption(run<ChoiceExercise>('deck-fact', { fact: 'per-rank' }, seed))).toBe('4');
    }
  });

  it('only asks cards per rank by name, so a lesson cannot repeat it by chance', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      expect(run<ChoiceExercise>('deck-fact', {}, seed).prompt).not.toContain('each {rank}');
    }
  });

  it('puts look-alike hands side by side, with exactly one right answer', () => {
    const cases = [
      ['royal', 'royal-flush'],
      ['royal', 'straight-flush'],
      ['royal', 'straight'],
      ['royal', 'flush'],
      ['matching', 'full-house'],
      ['matching', 'three-of-a-kind'],
      ['matching', 'two-pair'],
      ['matching', 'four-of-a-kind'],
      ['run', 'straight'],
      ['run', 'flush'],
      ['run', 'high-card'],
      ['run', 'pair'],
    ] as const;

    for (const [family, target] of cases) {
      const want = (rungForTerm(target) as Rung).name;
      for (let seed = 0; seed < 60; seed++) {
        const exercise = run<Extract<Exercise, { kind: 'compare' }>>(
          'look-alike',
          { family, target },
          seed,
        );
        const names = exercise.hands.map((hand) => handName(rankFive(hand.cards)));

        expect(exercise.hands).toHaveLength(4);
        expect(new Set(names).size).toBe(4);
        expect(names.filter((name) => name === want)).toHaveLength(1);
        expect(names[exercise.answer]).toBe(want);
        expect(exercise.hands.map((hand) => hand.result)).toEqual(names);
        expect(exercise.explanation.length).toBeGreaterThan(0);
        exercise.hands.forEach((_, index) => {
          if (index === exercise.answer) expect(exercise.notes?.[index]).toBeUndefined();
          else expect(exercise.notes?.[index]).toMatch(/^That one is /);
        });
      }
    }
  });

  it('explains a wrong name using the hand itself', () => {
    const categories = Object.values(HandCategory);
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('name-hand', { categories }, seed);
      const actual = rungOfRank(rankFive(exercise.cards as Card[]));
      exercise.options.forEach((_, index) => {
        if (index === exercise.answer) expect(exercise.notes?.[index]).toBeUndefined();
        else expect(exercise.notes?.[index]).toContain(`so it is ${actual.phrase}.`);
      });
    }
  });

  it('shows a tidy hand with matching cards together', () => {
    const categories = [HandCategory.Pair, HandCategory.TwoPair, HandCategory.FullHouse];
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('name-hand', { categories, tidy: true }, seed);
      const ranks = (exercise.cards as Card[]).map(rankOf);
      const counts = ranks.map((rank) => ranks.filter((other) => other === rank).length);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    }
  });

  it('solves a worked comparison step by step and names the real winner', () => {
    const pairs = [
      [HandCategory.Pair, HandCategory.HighCard],
      [HandCategory.Pair, HandCategory.Pair],
      [HandCategory.Flush, HandCategory.Flush],
      [HandCategory.FullHouse, HandCategory.FullHouse],
    ];
    for (const pair of pairs) {
      for (let seed = 0; seed < 60; seed++) {
        const exercise = run<Extract<Exercise, { kind: 'worked' }>>(
          'worked-compare',
          { pair },
          seed,
        );
        const [rankA, rankB] = exercise.hands.map((hand) => rankFive(hand.cards));

        expect(rankA).not.toBe(rankB);
        expect(exercise.hands[0].result).toBe(handName(rankA));
        expect(exercise.hands[1].result).toBe(handName(rankB));
        expect(exercise.steps).toHaveLength(3);
        expect(exercise.steps[2]).toContain(`${rankA > rankB ? 'Hand A' : 'Hand B'} wins`);
      }
    }
  });

  it('shows hand names up front only when asked to', () => {
    const categories = [HandCategory.Pair, HandCategory.HighCard];
    const shown = run<Extract<Exercise, { kind: 'compare' }>>(
      'compare-hands',
      { categories, showNames: true },
      1,
    );
    expect(shown.showNames).toBe(true);
    expect(
      run<Extract<Exercise, { kind: 'compare' }>>('compare-hands', { categories }, 1).showNames,
    ).toBeFalsy();
  });

  it('keeps recall questions to the hands taught so far', () => {
    const allowed = LADDER.slice(0, 6);
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('ladder-next', { upTo: 'flush' }, seed);
      for (const option of exercise.options) {
        expect(allowed.some((rung) => rung.name === option)).toBe(true);
      }
      expect(allowed.some((rung) => exercise.prompt.endsWith(`than ${rung.phrase}?`))).toBe(true);
    }
  });

  it('asks for the direction requested, and says how far off a wrong pick is', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const up = run<ChoiceExercise>('ladder-next', { direction: 'up' }, seed);
      expect(up.prompt).toContain('stronger');
      expect(run<ChoiceExercise>('ladder-next', { direction: 'down' }, seed).prompt).toContain(
        'weaker',
      );
      up.options.forEach((_, index) => {
        if (index === up.answer) expect(up.notes?.[index]).toBeUndefined();
        else expect(up.notes?.[index]).toMatch(/steps? (above|below)/);
      });
    }
  });

  it('names the first pair put the wrong way round', () => {
    expect(orderMistake(['Straight', 'Flush', 'Pair'])).toBe(
      'You put a straight above a flush, but a flush is stronger.',
    );
    expect(orderMistake(['Flush', 'Pair', 'Straight'])).toBe(
      'You put a pair above a straight, but a straight is stronger.',
    );
    expect(orderMistake(['Flush', 'Straight', 'Pair'])).toBeUndefined();
  });

  it('corrects every wrong answer on the ranking concept questions', () => {
    for (const id of ['five-of-a-kind', 'royal-is-straight-flush', 'why-flush-beats-straight']) {
      for (let seed = 0; seed < 20; seed++) {
        const exercise = run<ChoiceExercise>('concept', { id }, seed);
        exercise.options.forEach((_, index) => {
          if (index === exercise.answer) expect(exercise.notes?.[index]).toBeUndefined();
          else expect(exercise.notes?.[index]?.length, id).toBeGreaterThan(0);
        });
      }
    }
  });

  it('never runs out of cards when ordering the rarest hands', () => {
    const categories = Object.values(HandCategory);
    for (let seed = 0; seed < 20000; seed++) {
      expect(() => run('order-hands', { categories, count: 4 }, seed)).not.toThrow();
    }
  });

  it('always asks about the hand just taught', () => {
    const categories = [HandCategory.Pair, HandCategory.Flush, HandCategory.Straight];
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>(
        'name-hand',
        { categories, target: HandCategory.Flush },
        seed,
      );
      expect(handName(rankFive(exercise.cards as Card[]))).toBe('Flush');
      expect(exercise.skills).toContain('term:flush');
    }
  });

  it('deals an ordinary straight flush when asked for one', () => {
    for (let seed = 0; seed < 400; seed++) {
      const exercise = run<ChoiceExercise>(
        'name-hand',
        {
          categories: [HandCategory.Flush, HandCategory.StraightFlush],
          target: HandCategory.StraightFlush,
        },
        seed,
      );
      expect(handName(rankFive(exercise.cards as Card[]))).toBe('Straight flush');
      expect(exercise.skills).toContain('term:straight-flush');
    }
  });

  it('says "only" just where a stronger hand on screen also contains the answer', () => {
    const prompt = (family: string, target: string) =>
      run<Extract<Exercise, { kind: 'compare' }>>('look-alike', { family, target }, 1).prompt;
    expect(prompt('run', 'flush')).toBe('Which one is a flush?');
    expect(prompt('royal', 'flush')).toBe('Which one is only a flush?');
  });

  it('says so when the name picked is inside a stronger hand', () => {
    const rung = (id: string) => rungForTerm(id) as Rung;
    expect(wrongNameNote('Pair', rung('two-pair'))).toContain('always name the strongest hand');
    expect(wrongNameNote('Flush', rung('royal-flush'))).toContain('always name the strongest hand');
    expect(wrongNameNote('Three of a kind', rung('full-house'))).toContain('strongest hand');
    expect(wrongNameNote('Straight', rung('flush'))).toContain('A straight needs');
  });

  it('describes a high card truthfully', () => {
    expect((rungForTerm('high-card') as Rung).rule).toContain('not all one suit');
  });

  it('plays the ace low when tidying ace to five', () => {
    expect(tidyHand(parseCards('5h 3d Ah 2c 4s')).map(rankOf)).toEqual([14, 2, 3, 4, 5]);
    expect(tidyHand(parseCards('Kh Qd Ah Jc Ts')).map(rankOf)).toEqual([10, 11, 12, 13, 14]);
  });

  it('gives odds a beginner can read', () => {
    expect(oneIn(rungForTerm('high-card') as Rung)).toBe('1 in 2');
    expect(oneIn(rungForTerm('pair') as Rung)).toBe('2 in 5');
    expect(oneIn(rungForTerm('flush') as Rung)).toBe('1 in 509');
  });

  it('outlines the best five cards in a worked example', () => {
    const categories = [HandCategory.Flush, HandCategory.Straight];
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<Extract<Exercise, { kind: 'worked' }>>(
        'worked-best-five',
        { categories },
        seed,
      );
      const hole = exercise.hands[0].cards;
      const board = exercise.board as Card[];
      const seven = [...hole, ...board];
      const best = exercise.best as Card[];

      expect(best).toHaveLength(5);
      expect(best.every((card) => seven.includes(card))).toBe(true);
      expect(rankFive(best)).toBe(bestOfSeven(hole, board));
    }
  });

  it('works through a kicker and names the real winner', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<Extract<Exercise, { kind: 'worked' }>>('worked-kicker', {}, seed);
      const board = exercise.board as Card[];
      const [rankA, rankB] = exercise.hands.map((hand) => bestOfSeven(hand.cards, board));

      expect(rankA).not.toBe(rankB);
      expect(exercise.hands[0].result).toBe('Pair');
      expect(exercise.hands[1].result).toBe('Pair');
      expect(exercise.steps[2]).toContain(`${rankA > rankB ? 'Hand A' : 'Hand B'} wins`);
    }
  });

  it('never calls the cards of a flush a kicker', () => {
    const high = rankFive(parseCards('Ah Kh 9h 6h 3h'));
    const low = rankFive(parseCards('As Ks 8s 6s 3s'));
    const text = explainWin('Hand A', high, 'Hand B', low);
    expect(text).toContain('next highest card');
    expect(text).not.toContain('{kicker}');

    for (let seed = 0; seed < SEEDS; seed++) {
      const kicker = run<Extract<Exercise, { kind: 'compare' }>>(
        'board-compare',
        { pattern: 'kicker' },
        seed,
      );
      expect(kicker.hands[0].result).not.toBe('Flush');
    }
  });

  it('explains picking the wrong five cards', () => {
    const pair = rankFive(parseCards('Ah Ad 9h 6c 3s'));
    const betterKicker = rankFive(parseCards('Ah Ad Kh 6c 3s'));
    const flush = rankFive(parseCards('2h 6h 9h Jh Kh'));
    expect(bestFiveMistake(betterKicker, betterKicker)).toBeUndefined();
    expect(bestFiveMistake(pair, betterKicker)).toContain('higher cards');
    expect(bestFiveMistake(pair, flush)).toBe('Those five make a pair, but a flush was possible.');
  });

  it('only blanks words that no other option could also fill', () => {
    const rivals = ['River', 'Turn', 'Flop', 'Street', 'Button', 'Cutoff', 'Pair', 'Flush', 'Pot'];
    for (let seed = 0; seed < 400; seed++) {
      const exercise = run<ChoiceExercise>('complete-sentence', {}, seed);
      if (exercise.prompt.startsWith('Which word completes')) {
        expect(rivals).not.toContain(correctOption(exercise));
      }
    }
  });

  it('deals only the requested close calls, with the evaluator picking the winner', () => {
    const pairs = [
      [HandCategory.Straight, HandCategory.Flush],
      [HandCategory.Flush, HandCategory.FullHouse],
    ] as const;

    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<Extract<Exercise, { kind: 'compare' }>>(
        'compare-hands',
        { pairs },
        seed,
      );
      const [rankA, rankB] = exercise.hands.map((hand) => rankFive(hand.cards));
      const dealt = [categoryOf(rankA), categoryOf(rankB)];

      expect(exercise.answer).toBe(rankA > rankB ? 0 : 1);
      expect(pairs.some((pair) => pair.every((category) => dealt.includes(category)))).toBe(true);
      expect(exercise.explanation).toContain('Rarer hands win');

      const cards = exercise.hands.flatMap((hand) => hand.cards);
      expect(new Set(cards).size).toBe(cards.length);
    }
  });

  it('compares two hands of one type, decided by the hand and not a side card', () => {
    for (const category of Object.values(HandCategory)) {
      for (let seed = 0; seed < 40; seed++) {
        const exercise = run<Extract<Exercise, { kind: 'compare' }>>(
          'compare-same',
          { categories: [category] },
          seed,
        );
        const [rankA, rankB] = exercise.hands.map((hand) => rankFive(hand.cards));

        expect(categoryOf(rankA)).toBe(category);
        expect(categoryOf(rankB)).toBe(category);
        expect(rankA).not.toBe(rankB);
        expect(exercise.answer).toBe(rankA > rankB ? 0 : 1);
        expect(exercise.explanation).not.toContain('{kicker}');
      }
    }
  });

  it('asks for the next step on the ladder', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const exercise = run<ChoiceExercise>('ladder-next', {}, seed);
      const index = LADDER.findIndex((rung) => exercise.prompt.endsWith(`than ${rung.phrase}?`));
      const step = exercise.prompt.includes('stronger') ? 1 : -1;

      expect(index).toBeGreaterThanOrEqual(0);
      expect(correctOption(exercise)).toBe(LADDER[index + step].name);
      expect(exercise.options).not.toContain(LADDER[index].name);
    }
  });

  it('orders hand names by the ladder', () => {
    for (const count of [4, 10]) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const exercise = run<Extract<Exercise, { kind: 'order' }>>('order-names', { count }, seed);
        const heights = exercise.order.map((index) =>
          LADDER.findIndex((rung) => rung.name === exercise.hands[index].result),
        );

        expect(exercise.hands).toHaveLength(count);
        expect(new Set(heights).size).toBe(count);
        expect(heights).toEqual([...heights].sort((a, b) => b - a));
      }
    }
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
      const ranks = exercise.order.map((index) => rankFive(exercise.hands[index].cards as Card[]));
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
