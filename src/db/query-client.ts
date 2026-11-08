import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The default, 'online', pauses queries when offline. All data here is local.
      networkMode: 'always',
      // Dexie only changes through our own mutations, which invalidate what they touch.
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    },
    mutations: { networkMode: 'always' },
  },
});
