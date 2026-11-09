import { useRegisterSW } from 'virtual:pwa-register/react';
import { useRouterState } from '@tanstack/react-router';
import { button } from '@/ui/button';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// An installed app can stay open for days without a page load, which is when
// browsers normally look for a new service worker.
function keepCheckingForUpdates(registration: ServiceWorkerRegistration) {
  const check = () => {
    if (navigator.onLine && !registration.installing) void registration.update().catch(() => {});
  };
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (registration) keepCheckingForUpdates(registration);
    },
  });

  // Lessons, reviews and tables, with their result screens, sit outside the tab layout.
  // An update found there stays pending until the player is back on a tab.
  const onTabScreen = useRouterState({
    select: (state) => state.matches.some((match) => match.routeId === '/_app'),
  });

  if (!needRefresh || !onTabScreen) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(84px+var(--safe-bottom))] z-20 mx-auto flex max-w-md items-center justify-between gap-2 rounded-[14px] border border-line bg-surface py-2 pr-2 pl-4 shadow-lg lg:bottom-[calc(24px+var(--safe-bottom))]"
    >
      <span className="text-[15px] font-semibold">A new version is ready.</span>
      <div className="flex flex-none items-center gap-1">
        <button
          type="button"
          className="min-h-11 rounded-[10px] bg-transparent px-3 text-[15px] font-bold text-ink"
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </button>
        <button
          type="button"
          className={button('primary', 'min-h-11 px-4')}
          onClick={() => void updateServiceWorker(true)}
        >
          Reload
        </button>
      </div>
    </div>
  );
}
