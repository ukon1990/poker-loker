import { createRouter } from '@tanstack/react-router';
import { queryClient } from '@/db/query-client';
import { routeTree } from '@/routeTree.gen';

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
