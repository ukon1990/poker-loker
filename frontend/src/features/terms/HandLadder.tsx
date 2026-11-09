import {
  LADDER,
  LADDER_GROUPS,
  oneIn,
  type Rung,
  rungForTerm,
  rungNote,
} from '@/curriculum/ladder';
import { PlayingCard } from '@/ui/PlayingCard';

function RungRow({ rung, active }: { rung: Rung; active: boolean }) {
  return (
    <li
      className={`flex items-center gap-1.5 rounded-[10px] border-2 px-2 py-px ${
        active ? 'border-green bg-felt-tint text-felt-ink' : 'border-transparent'
      }`}
    >
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-sm font-bold">{rung.name}</span>
        <span className="block text-[11px] font-semibold opacity-75">{rung.tag}</span>
      </span>
      {/* The smallest phones have room for the words or the cards, and the words matter more. */}
      <span className="hidden flex-none gap-0.5 min-[360px]:flex" aria-hidden="true">
        {rung.sample.map((card) => (
          <PlayingCard key={card} card={card} size="xxs" />
        ))}
      </span>
      <span className="w-[72px] flex-none text-right text-xs font-semibold whitespace-nowrap">
        {oneIn(rung)}
      </span>
    </li>
  );
}

/** All ten hands, strongest at the top, in the three groups they are taught in. */
export function HandLadder({ highlight = [] }: { highlight?: readonly string[] }) {
  return (
    <section aria-label="Hand rankings" className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 px-2.5 text-[13px] font-semibold text-ink-2">
        <span>Strongest at the top</span>
        <span>How often in five cards</span>
      </div>
      {[...LADDER_GROUPS].reverse().map((group) => (
        <div key={group.id}>
          <div className="px-2.5 text-[13px] font-bold text-ink-2">{group.label}</div>
          <ol className="m-0 flex list-none flex-col p-0">
            {LADDER.filter((rung) => rung.group === group.id)
              .reverse()
              .map((rung) => (
                <RungRow key={rung.termId} rung={rung} active={highlight.includes(rung.termId)} />
              ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

/** Folded away by default, so it is one tap away without crowding the screen. */
export function HandLadderPanel({ highlight }: { highlight?: readonly string[] }) {
  return (
    <details className="rounded-[14px] border border-line bg-surface">
      <summary className="min-h-[52px] cursor-pointer px-4 py-3.5 text-base font-bold">
        All ten hands, in order
      </summary>
      <div className="px-1 pb-3">
        <HandLadder highlight={highlight} />
      </div>
    </details>
  );
}

/** What a hand beats and loses to. Renders nothing for words that are not hands. */
export function RungNote({ termId }: { termId: string }) {
  const rung = rungForTerm(termId);
  return rung ? <p className="m-0 text-base leading-snug font-semibold">{rungNote(rung)}</p> : null;
}

/** The note and the ladder together, for a definition sheet. */
export function TermLadder({ termId }: { termId: string }) {
  const rung = rungForTerm(termId);
  if (!rung) return null;
  return (
    <>
      <RungNote termId={termId} />
      <HandLadderPanel highlight={[rung.termId]} />
    </>
  );
}
