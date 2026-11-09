import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import type { Exercise } from '@/curriculum/exercises';
import { db } from '@/db/client';
import { type RunResult, saveRun } from '@/db/progress';
import { dashboardQuery } from '@/db/queries';
import { viewFor } from '@/features/lesson/views';
import { RichText } from '@/features/terms/RichText';
import {
  answerCurrent,
  currentExercise,
  isFinished,
  runProgress,
  startRun,
  XP_FIRST_TRY,
} from '@/learning/lesson-run';
import { button } from '@/ui/button';
import { Icon } from '@/ui/Icon';
import { PlayingCard, type SuitName } from '@/ui/PlayingCard';
import { ProgressBar } from '@/ui/ProgressBar';
import { Sheet } from '@/ui/Sheet';

function Finished({
  result,
  title,
  reward,
}: {
  result: RunResult;
  title: string;
  reward?: LessonReward;
}) {
  return (
    <main className="mx-auto flex min-h-app max-w-[560px] flex-col items-center justify-center gap-5 px-5 text-center">
      <PlayingCard
        rank={reward?.rank ?? 'A'}
        suit={reward?.suit ?? 'spade'}
        size="lg"
        ring="green"
        tilt={-3}
      />
      <h1 className="m-0 text-[28px] leading-tight font-extrabold">{title}</h1>
      <div className="font-card text-5xl leading-none font-bold">+{result.xp} XP</div>
      {result.graded > 0 && (
        <p className="m-0 text-base text-ink-2">
          {result.firstTry} of {result.graded} right the first time
        </p>
      )}
      <Link to="/" className={button('primary', 'w-full max-w-xs')}>
        Continue
      </Link>
    </main>
  );
}

export interface LessonReward {
  rank: string;
  suit: SuitName;
}

export function LessonPlayer({
  exercises,
  lessonId,
  finishedTitle,
  reward,
}: {
  exercises: readonly Exercise[];
  lessonId: string | null;
  finishedTitle: string;
  /** The card earned by finishing. */
  reward?: LessonReward;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [run, setRun] = useState(() => startRun(exercises.length));
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [note, setNote] = useState<string>();
  const [missedSkills, setMissedSkills] = useState<readonly string[]>([]);
  const [checked, setChecked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const save = useMutation({
    mutationFn: (finalRun: typeof run) =>
      saveRun(db, { variantId: 'holdem-nl', lessonId, exercises, run: finalRun }),
    // 'all' refreshes the path while it is off screen, so it never shows the old state on return.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dashboardQuery.queryKey, refetchType: 'all' }),
  });

  const onAnswer = useCallback(
    (value: boolean | null, wrongNote?: string, skills: readonly string[] = []) => {
      setAnswer(value);
      setNote(wrongNote);
      setMissedSkills(skills);
    },
    [],
  );

  if (save.data) return <Finished result={save.data} title={finishedTitle} reward={reward} />;

  const index = currentExercise(run);
  if (index === null) {
    return <main className="p-8 text-center text-ink-2">Saving your progress…</main>;
  }

  const exercise = exercises[index];
  const { View, selfChecked, actionLabel } = viewFor(exercise);
  const missedBefore = run.missed.includes(index);

  const advance = () => {
    const next = answerCurrent(run, answer === true, missedSkills);
    setRun(next);
    setAnswer(null);
    setNote(undefined);
    setMissedSkills([]);
    setChecked(false);
    setAttempt((value) => value + 1);
    if (isFinished(next)) save.mutate(next);
  };

  const explanation = 'explanation' in exercise ? exercise.explanation : '';

  return (
    <div className="relative mx-auto flex min-h-app max-w-[560px] flex-col">
      <div className="flex items-center gap-2 py-3 pr-5 pl-2">
        <button
          type="button"
          aria-label="Close lesson"
          onClick={() => setLeaving(true)}
          className="flex size-11 items-center justify-center bg-transparent text-ink-2"
        >
          <Icon name="close" />
        </button>
        <div className="flex-1">
          <ProgressBar value={runProgress(run)} label="Lesson progress" height={8} />
        </div>
      </div>

      <Sheet open={leaving} onClose={() => setLeaving(false)} label="Leave this lesson?">
        <div className="flex flex-col gap-3.5 p-5 pb-7">
          <h2 className="m-0 text-xl font-extrabold">Leave this lesson?</h2>
          <p className="m-0 text-base leading-normal">Your answers so far won’t be saved.</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={button('outline')}
              onClick={() => void navigate({ to: '/' })}
            >
              Leave
            </button>
            <button type="button" className={button()} onClick={() => setLeaving(false)}>
              Keep going
            </button>
          </div>
        </div>
      </Sheet>

      <main className="flex flex-col gap-5 px-5 pt-2 pb-[calc(18rem+var(--safe-bottom))]">
        <View key={attempt} exercise={exercise} checked={checked} onAnswer={onAnswer} />
      </main>

      {!checked && (
        <div className="fixed inset-x-0 bottom-0 bg-ground/90 px-5 pt-5 pb-[calc(20px+var(--safe-bottom))]">
          <div className="mx-auto max-w-[520px]">
            {selfChecked ? (
              <button
                type="button"
                disabled={answer !== true}
                onClick={advance}
                className={button('primary', 'w-full min-h-[52px]')}
              >
                {actionLabel}
              </button>
            ) : (
              <button
                type="button"
                disabled={answer === null}
                onClick={() => setChecked(true)}
                className={button('primary', 'w-full min-h-[52px]')}
              >
                Confirm
              </button>
            )}
          </div>
        </div>
      )}

      {checked && (
        <section
          aria-live="polite"
          className={`fixed inset-x-0 bottom-0 px-5 pt-5 pb-[calc(28px+var(--safe-bottom))] ${answer ? 'bg-felt-tint text-felt-ink' : 'bg-red-tint text-red-ink'}`}
        >
          <div className="mx-auto flex max-w-[520px] flex-col gap-3">
            <div className="flex items-center gap-2 text-xl font-extrabold">
              <Icon name={answer ? 'check' : 'close'} strokeWidth={3} />
              <span>
                {answer ? (missedBefore ? 'Correct' : `Correct, +${XP_FIRST_TRY} XP`) : 'Not quite'}
              </span>
            </div>
            <p className="m-0 text-base leading-snug">
              {!answer && note && <span className="mb-1.5 block font-bold">{note}</span>}
              <RichText text={explanation} />
              {!answer && ' You’ll see this one again before the lesson ends.'}
            </p>
            <button
              type="button"
              onClick={advance}
              className={button(answer ? 'felt' : 'red', 'w-full min-h-[52px]')}
            >
              Continue
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
