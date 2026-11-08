import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
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
import { PlayingCard } from '@/ui/PlayingCard';
import { ProgressBar } from '@/ui/ProgressBar';

function Finished({ result, title }: { result: RunResult; title: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-5 px-5 text-center">
      <PlayingCard rank="A" suit="spade" size="lg" ring="green" tilt={-3} />
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

export function LessonPlayer({
  exercises,
  lessonId,
  finishedTitle,
}: {
  exercises: readonly Exercise[];
  lessonId: string | null;
  finishedTitle: string;
}) {
  const queryClient = useQueryClient();
  const [run, setRun] = useState(() => startRun(exercises.length));
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const save = useMutation({
    mutationFn: (finalRun: typeof run) =>
      saveRun(db, { variantId: 'holdem-nl', lessonId, exercises, run: finalRun }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dashboardQuery.queryKey }),
  });

  const onAnswer = useCallback((value: boolean | null) => setAnswer(value), []);

  if (save.data) return <Finished result={save.data} title={finishedTitle} />;

  const index = currentExercise(run);
  if (index === null) {
    return <main className="p-8 text-center text-ink-2">Saving your progress…</main>;
  }

  const exercise = exercises[index];
  const { View, selfChecked, actionLabel } = viewFor(exercise);
  const missedBefore = run.missed.includes(index);

  const advance = () => {
    const next = answerCurrent(run, answer === true);
    setRun(next);
    setAnswer(null);
    setChecked(false);
    setAttempt((value) => value + 1);
    if (isFinished(next)) save.mutate(next);
  };

  const explanation = 'explanation' in exercise ? exercise.explanation : '';

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <div className="flex items-center gap-2 py-3 pr-5 pl-2">
        <Link
          to="/"
          aria-label="Close lesson"
          className="flex size-11 items-center justify-center text-ink-2"
        >
          <Icon name="close" />
        </Link>
        <div className="flex-1">
          <ProgressBar value={runProgress(run)} label="Lesson progress" height={8} />
        </div>
      </div>

      <main className="flex flex-col gap-5 px-5 pt-2 pb-72">
        <View key={attempt} exercise={exercise} checked={checked} onAnswer={onAnswer} />
      </main>

      {!checked && (
        <div className="fixed inset-x-0 bottom-0 bg-ground/90 px-5 py-5">
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
                Check
              </button>
            )}
          </div>
        </div>
      )}

      {checked && (
        <section
          aria-live="polite"
          className={`fixed inset-x-0 bottom-0 px-5 pt-5 pb-7 ${answer ? 'bg-felt-tint text-felt-ink' : 'bg-red-tint text-red-ink'}`}
        >
          <div className="mx-auto flex max-w-[520px] flex-col gap-3">
            <div className="flex items-center gap-2 text-xl font-extrabold">
              <Icon name={answer ? 'check' : 'close'} strokeWidth={3} />
              <span>
                {answer ? (missedBefore ? 'Correct' : `Correct, +${XP_FIRST_TRY} XP`) : 'Not quite'}
              </span>
            </div>
            <p className="m-0 text-base leading-snug">
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
