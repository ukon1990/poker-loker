import { type Card, formatCard, rankOf, suitOf } from '@/engine/core/cards';

export type SuitName = 'spade' | 'heart' | 'diamond' | 'club';
export type CardSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg';

export const SUIT_PATHS: Record<SuitName, string> = {
  spade:
    'M12 2C15 7 21 10 21 15C21 18.2 18.6 20 16.2 20C14.8 20 13.7 19.5 13 18.6C13.2 20.2 14 21.3 15.5 22H8.5C10 21.3 10.8 20.2 11 18.6C10.3 19.5 9.2 20 7.8 20C5.4 20 3 18.2 3 15C3 10 9 7 12 2Z',
  heart:
    'M12 21.5C5 15.5 2 12 2 8C2 4.9 4.4 3 7 3C9 3 10.9 4.1 12 6C13.1 4.1 15 3 17 3C19.6 3 22 4.9 22 8C22 12 19 15.5 12 21.5Z',
  diamond:
    'M12 1.5C14.5 6 17.5 9.5 20.5 12C17.5 14.5 14.5 18 12 22.5C9.5 18 6.5 14.5 3.5 12C6.5 9.5 9.5 6 12 1.5Z',
  club: 'M12 2.4a4.6 4.6 0 0 1 4.1 6.7 4.6 4.6 0 1 1-3.1 7.9c.2 2.2 1 3.7 2.5 5H8.5c1.5-1.3 2.3-2.8 2.5-5a4.6 4.6 0 1 1-3.1-7.9A4.6 4.6 0 0 1 12 2.4z',
};

const SIZES: Record<
  CardSize,
  { w: number; h: number; r: number; pad: number; rank: number; small: number; big: number }
> = {
  xxs: { w: 22, h: 31, r: 3, pad: 2, rank: 10, small: 7, big: 9 },
  xs: { w: 40, h: 56, r: 6, pad: 4, rank: 17, small: 11, big: 18 },
  sm: { w: 52, h: 73, r: 7, pad: 5, rank: 22, small: 13, big: 26 },
  md: { w: 64, h: 90, r: 8, pad: 6, rank: 27, small: 15, big: 32 },
  lg: { w: 84, h: 118, r: 10, pad: 8, rank: 34, small: 19, big: 44 },
};

const SUIT_BY_INDEX: readonly SuitName[] = ['spade', 'heart', 'diamond', 'club'];
const RANK_LABELS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

// Cards keep their paper colours in dark mode, like real cards.
const PAPER = '#ffffff';
const INK = '#15171a';
const RED = '#c4122f';

interface PlayingCardProps {
  card?: Card;
  /** For cards that are not real game cards, such as lessons on the path. */
  rank?: string;
  suit?: SuitName;
  size?: CardSize;
  back?: 'felt' | 'quiet';
  ring?: 'red' | 'ink' | 'green';
  tilt?: number;
}

function Suit({ path, size, style }: { path: string; size: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={style}>
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export function PlayingCard({
  card,
  rank,
  suit,
  size = 'md',
  back,
  ring,
  tilt = 0,
}: PlayingCardProps) {
  const s = SIZES[size];
  const suitName = card === undefined ? (suit ?? 'spade') : SUIT_BY_INDEX[suitOf(card)];
  const rankLabel =
    card === undefined ? (rank ?? 'A') : (RANK_LABELS[rankOf(card)] ?? String(rankOf(card)));
  const isRed = suitName === 'heart' || suitName === 'diamond';

  const latticeLine = back === 'felt' ? 'rgba(255,255,255,0.22)' : 'rgba(21,23,26,0.09)';
  const ringColor = ring === 'red' ? RED : ring === 'green' ? '#0e5b49' : INK;
  const baseShadow = '0 1px 3px rgba(21,23,26,0.18)';

  return (
    <div
      role="img"
      aria-label={
        back
          ? 'Face-down card'
          : card === undefined
            ? `${rankLabel} of ${suitName}s`
            : formatCard(card)
      }
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        flex: 'none',
        width: s.w,
        height: s.h,
        borderRadius: s.r,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        overflow: 'hidden',
        backgroundColor: back === 'felt' ? '#0e5b49' : back === 'quiet' ? '#ecebe6' : PAPER,
        backgroundImage: back
          ? `repeating-linear-gradient(45deg, ${latticeLine} 0 1px, transparent 1px 6px), repeating-linear-gradient(-45deg, ${latticeLine} 0 1px, transparent 1px 6px)`
          : undefined,
        border: `1px solid ${back === 'felt' ? 'rgba(255,255,255,0.28)' : 'rgba(21,23,26,0.14)'}`,
        boxShadow: ring ? `0 0 0 2px ${ringColor}, ${baseShadow}` : baseShadow,
        color: isRed ? RED : INK,
        fontFamily: 'var(--font-card)',
      }}
    >
      {!back && (
        <>
          <div
            style={{
              position: 'absolute',
              top: s.pad,
              left: s.pad,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <span
              style={{ fontSize: s.rank, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}
            >
              {rankLabel}
            </span>
            <Suit path={SUIT_PATHS[suitName]} size={s.small} />
          </div>
          <Suit
            path={SUIT_PATHS[suitName]}
            size={s.big}
            style={{ position: 'absolute', right: s.pad, bottom: s.pad }}
          />
        </>
      )}
    </div>
  );
}

export function EmptyCardSlot({ size = 'md' }: { size?: CardSize }) {
  const s = SIZES[size];
  return (
    <div
      aria-hidden="true"
      style={{
        boxSizing: 'border-box',
        flex: 'none',
        width: s.w,
        height: s.h,
        borderRadius: s.r,
        border: '1.5px dashed rgba(255,255,255,0.35)',
      }}
    />
  );
}
