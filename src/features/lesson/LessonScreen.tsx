import { useState } from 'react';
import { generateLesson, HOLDEM_COURSE, type Lesson } from '@/curriculum/course';
import { LessonPlayer } from '@/features/lesson/LessonPlayer';
import { randomSeed } from '@/learning/seed';

export function LessonScreen({ lesson }: { lesson: Lesson }) {
  // A new seed each time, so every play-through deals different cards.
  const [exercises] = useState(() => generateLesson(HOLDEM_COURSE, lesson, randomSeed()));
  return (
    <LessonPlayer exercises={exercises} lessonId={lesson.id} finishedTitle="Lesson complete" />
  );
}
