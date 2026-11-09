import { describe, expect, it } from 'vitest';
import { allLessons, HOLDEM_COURSE } from '@/curriculum/course';
import type { LessonProgress } from '@/db/schema';
import { lessonStatuses } from '@/learning/course-state';
import { addDays } from '@/learning/days';
import {
  answerCurrent,
  currentExercise,
  isFinished,
  runProgress,
  runXp,
  startRun,
} from '@/learning/lesson-run';
import { averageMastery, MAX_BOX, updateMastery } from '@/learning/mastery';

describe('lesson run', () => {
  it('goes through exercises in order', () => {
    let run = startRun(2);
    expect(currentExercise(run)).toBe(0);
    run = answerCurrent(run, true);
    expect(currentExercise(run)).toBe(1);
    run = answerCurrent(run, true);
    expect(isFinished(run)).toBe(true);
    expect(runProgress(run)).toBe(1);
  });

  it('sends a wrong answer to the end, and it must be answered to finish', () => {
    let run = startRun(3);
    run = answerCurrent(run, false);
    expect(run.queue).toEqual([1, 2, 0]);
    expect(run.missed).toEqual([0]);

    run = answerCurrent(answerCurrent(run, true), true);
    expect(currentExercise(run)).toBe(0);
    expect(isFinished(run)).toBe(false);

    run = answerCurrent(run, true);
    expect(isFinished(run)).toBe(true);
  });

  it('counts a repeated miss once', () => {
    let run = startRun(1);
    run = answerCurrent(answerCurrent(run, false), false);
    expect(run.missed).toEqual([0]);
  });

  it('does not count a wrong answer as progress', () => {
    const run = answerCurrent(startRun(4), false);
    expect(runProgress(run)).toBe(0);
  });

  it('awards more XP for first-try answers', () => {
    expect(runXp(5, 0)).toBe(50);
    expect(runXp(5, 2)).toBe(40);
  });
});

describe('mastery', () => {
  const today = '2026-11-08';

  it('starts in a low box and comes back soon after a miss', () => {
    const entry = updateMastery(undefined, 'holdem-nl', 'outs', false, today);
    expect(entry).toMatchObject({ box: 1, dueDay: addDays(today, 1), incorrect: 1 });
  });

  it('waits longer as answers stay correct', () => {
    let entry = updateMastery(undefined, 'holdem-nl', 'outs', true, today);
    const firstWait = entry.dueDay;
    entry = updateMastery(entry, 'holdem-nl', 'outs', true, today);
    expect(entry.box).toBe(3);
    expect(entry.dueDay > firstWait).toBe(true);
  });

  it('stays within the boxes', () => {
    let entry = updateMastery(undefined, 'holdem-nl', 'outs', true, today);
    for (let i = 0; i < 10; i++) entry = updateMastery(entry, 'holdem-nl', 'outs', true, today);
    expect(entry.box).toBe(MAX_BOX);
    for (let i = 0; i < 10; i++) entry = updateMastery(entry, 'holdem-nl', 'outs', false, today);
    expect(entry.box).toBe(1);
  });

  it('averages from 0 to 1', () => {
    expect(averageMastery([])).toBe(0);
    const top = updateMastery(
      { variantId: 'holdem-nl', skillId: 'a', box: 5, dueDay: today, correct: 1, incorrect: 0 },
      'holdem-nl',
      'a',
      true,
      today,
    );
    expect(averageMastery([top])).toBe(1);
  });
});

describe('course state', () => {
  const lessons = allLessons(HOLDEM_COURSE);
  const completed = (lessonId: string): LessonProgress => ({
    variantId: 'holdem-nl',
    lessonId,
    status: 'completed',
    bestScore: 1,
    completedAt: 1,
    updatedAt: 1,
  });

  it('unlocks only the first lesson at the start', () => {
    const statuses = lessonStatuses(HOLDEM_COURSE, []);
    expect(statuses.get(lessons[0].id)).toBe('current');
    expect(statuses.get(lessons[1].id)).toBe('locked');
  });

  it('moves the current lesson along as lessons are finished', () => {
    const statuses = lessonStatuses(HOLDEM_COURSE, [completed(lessons[0].id)]);
    expect(statuses.get(lessons[0].id)).toBe('done');
    expect(statuses.get(lessons[1].id)).toBe('current');
    expect(statuses.get(lessons[2].id)).toBe('locked');
  });
});

describe('days', () => {
  it('adds days across months', () => {
    expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
  });
});
