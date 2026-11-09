const BASE =
  'inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-[10px] text-base font-bold no-underline text-center select-none';

const VARIANTS = {
  primary: 'bg-ink text-on-ink disabled:bg-line disabled:text-ink-2',
  outline: 'border-2 border-ink bg-transparent text-ink disabled:border-line disabled:text-ink-2',
  felt: 'bg-felt text-on-felt',
  red: 'bg-red text-on-red',
  paper: 'bg-white text-[#15171a]',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

/** Classes for a button-styled `<button>` or link. */
export function button(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}
