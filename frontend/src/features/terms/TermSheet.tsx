import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { useEffect } from 'react';
import { getTerm } from '@/curriculum/glossary';
import { db } from '@/db/client';
import { addTermToReview } from '@/db/progress';
import { dashboardQuery } from '@/db/queries';
import { TermLadder } from '@/features/terms/HandLadder';
import { RichText } from '@/features/terms/RichText';
import { closeTerm, termStore } from '@/features/terms/term-store';
import { button } from '@/ui/button';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';

export function TermSheet() {
  const open = useSelector(termStore);
  const queryClient = useQueryClient();
  const term = open ? getTerm(open.id) : null;
  const fromTable = open?.source === 'table';
  const openId = open?.id;

  useEffect(() => {
    if (!fromTable || !openId) return;
    void addTermToReview(db, 'holdem-nl', openId).then(() =>
      queryClient.invalidateQueries({ queryKey: dashboardQuery.queryKey }),
    );
  }, [fromTable, openId, queryClient]);

  return (
    <Sheet
      open={term !== null}
      onClose={closeTerm}
      label={term ? `${term.term}, definition` : 'Definition'}
    >
      {term && (
        <div className="flex flex-col gap-3.5 p-5 pb-7">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2.5">
              <h2 className="m-0 font-card text-4xl leading-none font-bold">{term.term}</h2>
              {term.abbreviation && (
                <span className="text-[15px] font-bold text-ink-2">{term.abbreviation}</span>
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={closeTerm}
              className="-mr-2.5 flex size-11 items-center justify-center bg-transparent text-ink-2"
            >
              <Icon name="close" />
            </button>
          </div>

          <p className="m-0 text-base leading-normal">
            <RichText text={term.long} source={open?.source} />
          </p>

          <TermLadder termId={term.id} />

          {open?.context && (
            <div className="rounded-xl bg-ground px-3.5 py-3">
              <div className="mb-0.5 text-[13px] font-semibold text-ink-2">In this hand</div>
              <div className="text-[15px] leading-snug">{open.context}</div>
            </div>
          )}

          {!open?.context && term.example && (
            <div className="rounded-xl bg-ground px-3.5 py-3">
              <div className="mb-0.5 text-[13px] font-semibold text-ink-2">
                At the table you might hear
              </div>
              <div className="text-[15px] leading-snug">“{term.example}”</div>
            </div>
          )}

          {fromTable && (
            <div className="text-[13px] font-semibold text-ink-2">Added to your review</div>
          )}

          <div className={`grid gap-2 ${fromTable ? 'grid-cols-2' : ''}`}>
            {fromTable && (
              <Link to="/glossary" className={button('outline')} onClick={closeTerm}>
                Glossary
              </Link>
            )}
            <button type="button" className={button()} onClick={closeTerm}>
              {fromTable ? 'Back to the hand' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
