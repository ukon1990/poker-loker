import { useRegisterSW } from 'virtual:pwa-register/react';
import { button } from '@/ui/button';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-3 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-[14px] border border-line bg-surface p-3 shadow-lg"
    >
      <span className="text-[15px] font-semibold">A new version is available.</span>
      <button
        type="button"
        className={button('primary', 'min-h-11')}
        onClick={() => void updateServiceWorker(true)}
      >
        Update
      </button>
    </div>
  );
}
