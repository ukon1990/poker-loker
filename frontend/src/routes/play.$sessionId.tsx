import { createFileRoute, redirect } from '@tanstack/react-router';
import { db } from '@/db/client';
import { settingsQuery } from '@/db/queries';
import { getPlaySession } from '@/db/repositories';
import { TableScreen } from '@/features/table/TableScreen';

export const Route = createFileRoute('/play/$sessionId')({
  loader: async ({ context, params }) => {
    const [session] = await Promise.all([
      getPlaySession(db, params.sessionId),
      context.queryClient.ensureQueryData(settingsQuery),
    ]);
    if (!session) throw redirect({ to: '/play' });
    return session;
  },
  // A table holds a live game, so it should never be reloaded behind the player's back.
  staleTime: Number.POSITIVE_INFINITY,
  component: TableRoute,
});

function TableRoute() {
  return <TableScreen session={Route.useLoaderData()} />;
}
