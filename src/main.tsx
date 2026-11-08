import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { requestPersistentStorage } from '@/db/persistence';
import { queryClient } from '@/db/query-client';
import { router } from '@/router';
import '@fontsource-variable/figtree';
import '@fontsource/zilla-slab/700.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

// Firefox prompts for this, so wait for the first interaction instead of asking at page load.
window.addEventListener('pointerdown', () => void requestPersistentStorage(), { once: true });
