import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { dashboardQuery } from '@/db/queries';
import { Icon, type IconName } from '@/ui/Icon';

const TABS = [
  { to: '/', label: 'Learn', icon: 'learn' },
  { to: '/practice', label: 'Practice', icon: 'practice' },
  { to: '/play', label: 'Play', icon: 'play' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
] as const satisfies readonly { to: string; label: string; icon: IconName }[];

const RAIL_EXTRAS = [
  { to: '/glossary', label: 'Glossary', icon: 'glossary' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
] as const satisfies readonly { to: string; label: string; icon: IconName }[];

function AppLayout() {
  return (
    <div className="min-h-dvh lg:flex">
      <nav
        aria-label="Main"
        className="hidden w-[220px] flex-none flex-col gap-1 border-r border-line bg-surface px-4 py-7 lg:flex"
      >
        <div className="px-3 pb-6 font-card text-[26px] leading-none font-bold">Poker Loker</div>
        {[...TABS, ...RAIL_EXTRAS].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === '/' }}
            className="flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-base font-medium text-ink-2 no-underline data-[status=active]:bg-ground data-[status=active]:font-bold data-[status=active]:text-ink"
          >
            <Icon name={item.icon} size={22} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="min-w-0 flex-1 pb-[72px] lg:pb-0">
        <Outlet />
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 grid h-[72px] grid-cols-4 border-t border-line bg-surface lg:hidden"
      >
        {TABS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === '/' }}
            className="flex flex-col items-center justify-center gap-[3px] text-[13px] font-medium text-ink-2 no-underline data-[status=active]:font-bold data-[status=active]:text-ink"
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export const Route = createFileRoute('/_app')({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: AppLayout,
});
