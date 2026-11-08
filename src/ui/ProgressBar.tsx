export function ProgressBar({
  value,
  label,
  height = 6,
}: {
  /** From 0 to 1. */
  value: number;
  label: string;
  height?: number;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="bg-line"
      style={{ height, borderRadius: height / 2 }}
    >
      <div
        className="bg-ink transition-[width] duration-300"
        style={{ width: `${percent}%`, height, borderRadius: height / 2 }}
      />
    </div>
  );
}
