import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { generateReview } from '@/curriculum/course';
import { dashboardQuery } from '@/db/queries';
import { LessonPlayer } from '@/features/lesson/LessonPlayer';
import { randomSeed } from '@/learning/seed';
import { button } from '@/ui/button';

const SESSION_SIZE = 10;
const SINGLE_SKILL_SIZE = 8;

export function ReviewScreen({ skill }: { skill?: string }) {
  const { data } = useSuspenseQuery(dashboardQuery);

  // Fixed on arrival, so saving progress mid-session can't change the questions.
  const [exercises] = useState(() => {
    if (skill) {
      return generateReview(Array<string>(SINGLE_SKILL_SIZE).fill(skill), randomSeed(), []);
    }
    const pool = data.dueSkills.length > 0 ? data.dueSkills : data.mastery;
    const skills = [...pool]
      .sort((a, b) => a.box - b.box)
      .slice(0, SESSION_SIZE)
      .map((entry) => entry.skillId);
    return generateReview(skills, randomSeed(), []);
  });

  if (exercises.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="m-0 text-[28px] font-extrabold">Nothing to review yet</h1>
        <p className="m-0 text-base text-ink-2">
          Finish a lesson and your weak spots will show up here.
        </p>
        <Link to="/" className={button()}>
          Go to lessons
        </Link>
      </main>
    );
  }

  return <LessonPlayer exercises={exercises} lessonId={null} finishedTitle="Review complete" />;
}
