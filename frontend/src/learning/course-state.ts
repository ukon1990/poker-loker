import type { Course, Lesson } from '@/curriculum/course';
import { allLessons } from '@/curriculum/course';
import type { LessonProgress } from '@/db/schema';

export type LessonStatus = 'done' | 'current' | 'locked';

/** Lessons unlock in order. The first unfinished lesson is the current one. */
export function lessonStatuses(
  course: Course,
  progress: readonly LessonProgress[],
): Map<string, LessonStatus> {
  const completed = new Set(
    progress.filter((entry) => entry.status === 'completed').map((entry) => entry.lessonId),
  );
  const statuses = new Map<string, LessonStatus>();
  let foundCurrent = false;

  for (const lesson of allLessons(course)) {
    if (completed.has(lesson.id)) {
      statuses.set(lesson.id, 'done');
    } else if (foundCurrent) {
      statuses.set(lesson.id, 'locked');
    } else {
      statuses.set(lesson.id, 'current');
      foundCurrent = true;
    }
  }
  return statuses;
}

export function currentLesson(
  course: Course,
  progress: readonly LessonProgress[],
): Lesson | undefined {
  const statuses = lessonStatuses(course, progress);
  return allLessons(course).find((lesson) => statuses.get(lesson.id) === 'current');
}
