/** Progress through a lesson. Plain data: the exercises themselves live alongside it. */
export interface LessonRun {
  /** Exercise indexes still to answer, in order. */
  queue: number[];
  total: number;
  /** Exercises that were wrong at least once. */
  missed: number[];
  /** For exercises finished with some parts wrong: the skills that were missed. */
  missedSkills?: Record<number, readonly string[]>;
}

export const XP_FIRST_TRY = 10;
export const XP_AFTER_RETRY = 5;

export function startRun(total: number): LessonRun {
  return { queue: Array.from({ length: total }, (_, i) => i), total, missed: [] };
}

export function currentExercise(run: LessonRun): number | null {
  return run.queue[0] ?? null;
}

/** A wrong answer goes to the end of the queue, with the same cards. */
export function answerCurrent(
  run: LessonRun,
  correct: boolean,
  missedSkills: readonly string[] = [],
): LessonRun {
  const [current, ...rest] = run.queue;
  if (current === undefined) return run;
  if (correct && missedSkills.length > 0) {
    return {
      ...run,
      queue: rest,
      missed: [...run.missed, current],
      missedSkills: { ...run.missedSkills, [current]: missedSkills },
    };
  }
  if (correct) return { ...run, queue: rest };

  return {
    ...run,
    queue: [...rest, current],
    missed: run.missed.includes(current) ? run.missed : [...run.missed, current],
  };
}

export function isFinished(run: LessonRun): boolean {
  return run.queue.length === 0;
}

/** From 0 to 1. An exercise counts once it is answered correctly. */
export function runProgress(run: LessonRun): number {
  return run.total === 0 ? 1 : (run.total - run.queue.length) / run.total;
}

export function runXp(gradedCount: number, missedGraded: number): number {
  return (gradedCount - missedGraded) * XP_FIRST_TRY + missedGraded * XP_AFTER_RETRY;
}
