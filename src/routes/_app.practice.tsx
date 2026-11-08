import { createFileRoute } from '@tanstack/react-router';
import { PracticeScreen } from '@/features/review/PracticeScreen';

export const Route = createFileRoute('/_app/practice')({
  component: PracticeScreen,
});
