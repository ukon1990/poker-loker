type ChipTone = 'red' | 'felt' | 'ink' | 'paper';

const TONES: Record<ChipTone, { bg: string; fg: string; dash: string }> = {
  red: { bg: '#c4122f', fg: '#ffffff', dash: 'rgba(255,255,255,0.7)' },
  felt: { bg: '#0e5b49', fg: '#ffffff', dash: 'rgba(255,255,255,0.7)' },
  ink: { bg: '#15171a', fg: '#ffffff', dash: 'rgba(255,255,255,0.7)' },
  paper: { bg: '#ffffff', fg: '#15171a', dash: 'rgba(21,23,26,0.45)' },
};

export function Chip({
  value,
  tone = 'red',
  px = 36,
}: {
  value: number;
  tone?: ChipTone;
  px?: number;
}) {
  const t = TONES[tone];
  const digits = String(value).length;
  return (
    <div
      style={{
        position: 'relative',
        flex: 'none',
        width: px,
        height: px,
        borderRadius: '50%',
        background: t.bg,
        color: t.fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(21,23,26,0.35)',
        fontFamily: 'var(--font-card)',
        fontWeight: 700,
        fontSize: Math.round(px * (digits > 3 ? 0.22 : 0.3)),
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: Math.max(2, Math.round(px * 0.07)),
          borderRadius: '50%',
          border: `2px dashed ${t.dash}`,
        }}
      />
      <span>{value}</span>
    </div>
  );
}
