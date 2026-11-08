import { createFileRoute } from '@tanstack/react-router';
import { handHistoryQuery } from '@/db/queries';
import { HistoryScreen } from '@/features/history/HistoryScreen';

export const Route = createFileRoute('/_app/history')({
  loader: ({ context }) => context.queryClient.ensureQueryData(handHistoryQuery),
  component: HistoryScreen,
});
