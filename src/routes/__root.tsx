import type { QueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { lazy, Suspense, useEffect } from 'react';
import { settingsQuery } from '@/db/queries';
import { UpdatePrompt } from '@/features/pwa/UpdatePrompt';
import { TermSheet } from '@/features/terms/TermSheet';

export interface RouterContext {
  queryClient: QueryClient;
}

const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((module) => ({
        default: module.TanStackRouterDevtools,
      })),
    )
  : () => null;

const QueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : () => null;

function RootLayout() {
  const { data: settings } = useQuery(settingsQuery);
  const theme = settings?.theme ?? 'system';

  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      <Outlet />
      <TermSheet />
      <UpdatePrompt />
      <Suspense>
        <RouterDevtools />
        <QueryDevtools />
      </Suspense>
    </>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});
