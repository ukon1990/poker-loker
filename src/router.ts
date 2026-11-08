import { createHashHistory, createRouter } from '@tanstack/react-router';
import { queryClient } from '@/db/query-client';
import { routeTree } from '@/routeTree.gen';

export const router = createRouter({
  routeTree,
  // A static bucket has no rewrite rules, so the route lives in the URL hash.
  history: createHashHistory(),
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
