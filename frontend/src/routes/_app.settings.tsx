import { createFileRoute } from '@tanstack/react-router';
import { settingsQuery } from '@/db/queries';
import { SettingsScreen } from '@/features/settings/SettingsScreen';

export const Route = createFileRoute('/_app/settings')({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsScreen,
});
