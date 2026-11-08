import { createFileRoute, redirect } from '@tanstack/react-router';
import { findLesson, HOLDEM_COURSE } from '@/curriculum/course';
import { dashboardQuery } from '@/db/queries';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import { lessonStatuses } from '@/learning/course-state';

export const Route = createFileRoute('/lesson/$lessonId')({
  loader: async ({ context, params }) => {
    const lesson = findLesson(HOLDEM_COURSE, params.lessonId);
    const { progress } = await context.queryClient.ensureQueryData(dashboardQuery);
    if (!lesson || lessonStatuses(HOLDEM_COURSE, progress).get(lesson.id) === 'locked') {
      throw redirect({ to: '/' });
    }
    return lesson;
  },
  component: LessonRoute,
});

function LessonRoute() {
  return <LessonScreen lesson={Route.useLoaderData()} />;
}
