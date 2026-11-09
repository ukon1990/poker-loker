import type { Exercise } from '@/curriculum/exercises';
import { awardXp, getSkillMastery, saveSkillMastery } from '@/db/repositories';
import type { LessonProgress, PokerDb } from '@/db/schema';
import type { VariantId } from '@/engine/variants/types';
import { localDay } from '@/learning/days';
import { type LessonRun, runXp } from '@/learning/lesson-run';
import { updateMastery } from '@/learning/mastery';

export interface RunResult {
  xp: number;
  graded: number;
  firstTry: number;
}

const isGraded = (exercise: Exercise) => exercise.kind !== 'new-word';

/** Saves a finished lesson or review as one transaction, so it can't be half recorded. */
export async function saveRun(
  db: PokerDb,
  input: {
    variantId: VariantId;
    /** Null for a review session. */
    lessonId: string | null;
    exercises: readonly Exercise[];
    run: LessonRun;
    now?: Date;
  },
): Promise<RunResult> {
  const { variantId, lessonId, exercises, run } = input;
  const now = input.now ?? new Date();
  const today = localDay(now);

  const missed = new Set(run.missed);
  const graded = exercises.filter(isGraded).length;
  const missedGraded = exercises.filter((e, i) => isGraded(e) && missed.has(i)).length;
  const xp = runXp(graded, missedGraded);

  await db.transaction(
    'rw',
    [db.profile, db.dailyActivity, db.lessonProgress, db.skillMastery, db.attempts],
    async () => {
      await awardXp(db, xp, now);

      for (const [index, exercise] of exercises.entries()) {
        if (!isGraded(exercise)) continue;
        const correct = !missed.has(index);

        await db.attempts.add({
          variantId,
          lessonId,
          exerciseType: exercise.kind,
          skillIds: exercise.skills,
          correct,
          answeredAt: now.getTime(),
          day: today,
        });

        for (const skillId of exercise.skills) {
          const previous = await getSkillMastery(db, variantId, skillId);
          await saveSkillMastery(db, updateMastery(previous, variantId, skillId, correct, today));
        }
      }

      if (lessonId) {
        const previous = await db.lessonProgress.get([variantId, lessonId]);
        const score = graded === 0 ? 1 : (graded - missedGraded) / graded;
        const entry: LessonProgress = {
          variantId,
          lessonId,
          status: 'completed',
          bestScore: Math.max(score, previous?.bestScore ?? 0),
          completedAt: previous?.completedAt ?? now.getTime(),
          updatedAt: now.getTime(),
        };
        await db.lessonProgress.put(entry);
      }
    },
  );

  return { xp, graded, firstTry: graded - missedGraded };
}

/** Makes a word due for review today. */
export async function addTermToReview(
  db: PokerDb,
  variantId: VariantId,
  termId: string,
  now = new Date(),
): Promise<void> {
  const today = localDay(now);
  const skillId = `term:${termId}`;
  await db.transaction('rw', db.skillMastery, async () => {
    const previous = await getSkillMastery(db, variantId, skillId);
    await saveSkillMastery(db, {
      variantId,
      skillId,
      box: previous?.box ?? 1,
      dueDay: today,
      correct: previous?.correct ?? 0,
      incorrect: previous?.incorrect ?? 0,
    });
  });
}
