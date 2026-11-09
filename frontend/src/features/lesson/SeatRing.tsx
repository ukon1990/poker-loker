import { positionNames } from '@/engine/core/table';

export type SeatMark = 'none' | 'picked' | 'right' | 'wrong' | 'highlight';

/** Seats around a table, clockwise. Used for position exercises and word cards. */
export function SeatRing({
  seatCount,
  buttonSeat,
  marks = {},
  onPick,
  disabled = false,
}: {
  seatCount: number;
  buttonSeat: number;
  marks?: Record<number, SeatMark>;
  onPick?: (seat: number) => void;
  disabled?: boolean;
}) {
  const seats = Array.from({ length: seatCount }, (_, seat) => seat);
  const names = positionNames(seats, buttonSeat);
  const place = (seat: number, radius: number) => {
    const angle = Math.PI / 2 + (seat * 2 * Math.PI) / seatCount;
    return { left: `${50 + radius * Math.cos(angle)}%`, top: `${50 + radius * Math.sin(angle)}%` };
  };

  const styleFor = (mark: SeatMark) => {
    switch (mark) {
      case 'picked':
      case 'highlight':
        return 'bg-white text-[#15171a] ring-2 ring-red';
      case 'right':
        return 'bg-felt-tint text-felt-ink ring-2 ring-white';
      case 'wrong':
        return 'bg-red-tint text-red-ink ring-2 ring-white';
      default:
        return 'bg-white/15 text-on-felt';
    }
  };

  return (
    <div className="relative h-[260px] rounded-[64px] bg-felt">
      {seats.map((seat) => {
        const mark = marks[seat] ?? 'none';
        const position = place(seat, 40);
        const classes = `absolute flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 font-card text-lg font-bold ${styleFor(mark)}`;
        return onPick ? (
          <button
            key={seat}
            type="button"
            disabled={disabled}
            aria-label={`Seat ${seat + 1}`}
            aria-pressed={mark === 'picked'}
            onClick={() => onPick(seat)}
            className={classes}
            style={position}
          >
            {seat + 1}
          </button>
        ) : (
          <div key={seat} className={classes} style={position}>
            {mark === 'highlight' ? names.get(seat) : ''}
          </div>
        );
      })}
      <div
        role="img"
        aria-label="Dealer button"
        className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white font-card text-base font-bold text-[#15171a]"
        style={place(buttonSeat, 22)}
      >
        D
      </div>
    </div>
  );
}
