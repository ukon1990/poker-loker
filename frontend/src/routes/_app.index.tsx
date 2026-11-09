import { createFileRoute } from '@tanstack/react-router';
import { PathScreen } from '@/features/path/PathScreen';

export const Route = createFileRoute('/_app/')({
  component: PathScreen,
});
