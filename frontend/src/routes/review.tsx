import { createFileRoute } from '@tanstack/react-router';
import { dashboardQuery } from '@/db/queries';
import { ReviewScreen } from '@/features/review/ReviewScreen';

export const Route = createFileRoute('/review')({
  validateSearch: (search: Record<string, unknown>): { skill?: string } =>
    typeof search.skill === 'string' ? { skill: search.skill } : {},
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: ReviewRoute,
});

function ReviewRoute() {
  const { skill } = Route.useSearch();
  return <ReviewScreen skill={skill} />;
}
