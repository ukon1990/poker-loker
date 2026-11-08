import { createFileRoute } from '@tanstack/react-router';
import { activeSessionsQuery } from '@/db/queries';
import { PlaySetupScreen } from '@/features/table/PlaySetupScreen';

export const Route = createFileRoute('/_app/play')({
  loader: ({ context }) => context.queryClient.ensureQueryData(activeSessionsQuery),
  component: PlaySetupScreen,
});
