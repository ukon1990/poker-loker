import { SUIT_PATHS } from '@/ui/PlayingCard';

const PATHS = {
  learn:
    'M8 3h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M3 7v12a2 2 0 0 0 2 2h9',
  practice: 'M20 11a8 8 0 0 0-14.3-4.9L3 9 M3 4v5h5 M4 13a8 8 0 0 0 14.3 4.9L21 15 M21 20v-5h-5',
  play: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z M12 3v5 M12 16v5 M3 12h5 M16 12h5',
  progress: 'M5 20v-6 M12 20V5 M19 20v-10',
  glossary: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z M5 17a3 3 0 0 1 3-3h11',
  history: 'M12 7v5l3 2 M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z',
  settings: 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 5v4 M8 15v4',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  check: 'M5 13l4 4L19 7',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 24,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function StreakMark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={SUIT_PATHS.diamond} fill="var(--red)" />
    </svg>
  );
}
