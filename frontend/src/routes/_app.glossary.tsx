import { createFileRoute } from '@tanstack/react-router';
import { GlossaryScreen } from '@/features/terms/GlossaryScreen';

export const Route = createFileRoute('/_app/glossary')({
  component: GlossaryScreen,
});
