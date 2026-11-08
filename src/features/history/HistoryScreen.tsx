import { useSuspenseQuery } from '@tanstack/react-query';
import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useState } from 'react';
import { handHistoryQuery } from '@/db/queries';
import type { HandRecord } from '@/db/schema';
import { handLog } from '@/features/table/hand-text';
import { button } from '@/ui/button';
import { PlayingCard } from '@/ui/PlayingCard';
import { Sheet } from '@/ui/Sheet';

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, HandRecord>();

const ROW_HEIGHT = 72;
const GRID = 'grid grid-cols-[56px_100px_minmax(0,1fr)_72px] items-center gap-2';

const columns = helper.columns([
  helper.accessor('handNumber', {
    header: 'Hand',
    cell: (info) => <span className="font-card text-lg font-bold">{info.getValue()}</span>,
  }),
  helper.accessor('heroHole', {
    header: 'Your cards',
    cell: (info) => (
      <span className="flex gap-1">
        {info.getValue().map((card) => (
          <PlayingCard key={card} card={card} size="xs" />
        ))}
      </span>
    ),
  }),
  helper.accessor('board', {
    header: 'Board',
    cell: (info) => (
      <span className="hidden gap-1 sm:flex">
        {info.getValue().map((card) => (
          <PlayingCard key={card} card={card} size="xs" />
        ))}
      </span>
    ),
  }),
  helper.accessor('heroNet', {
    header: 'Result',
    cell: (info) => {
      const net = info.getValue();
      return (
        <span
          className={`block text-right text-base font-bold ${net >= 0 ? 'text-green' : 'text-red'}`}
        >
          {net > 0 ? `+${net}` : net}
        </span>
      );
    },
  }),
]);

export function HistoryScreen() {
  const { data } = useSuspenseQuery(handHistoryQuery);
  const table = useTable({ features, columns, data });
  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<HandRecord | null>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <main className="mx-auto flex max-w-[760px] flex-col gap-3 p-5 lg:p-8">
      <h1 className="m-0 text-[28px] leading-tight font-extrabold">History</h1>

      {rows.length === 0 ? (
        <p className="m-0 text-base text-ink-2">Hands you play will show up here.</p>
      ) : (
        <>
          <div className={`${GRID} px-3 text-[13px] font-semibold text-ink-2`}>
            {table.getHeaderGroups()[0].headers.map((header) => (
              <span key={header.id} className={header.column.id === 'heroNet' ? 'text-right' : ''}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </span>
            ))}
          </div>

          <div
            ref={scrollRef}
            className="h-[calc(100dvh-220px)] overflow-y-auto rounded-[14px] border border-line bg-surface lg:h-[calc(100dvh-160px)]"
          >
            <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((item) => {
                const row = rows[item.index];
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelected(row.original)}
                    className={`${GRID} absolute inset-x-0 border-0 border-b border-solid border-line bg-transparent px-3 text-left text-ink`}
                    style={{ height: ROW_HEIGHT, top: item.start }}
                  >
                    {row.getAllCells().map((cell) => (
                      <span key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Sheet open={selected !== null} onClose={() => setSelected(null)} label="Hand details">
        {selected && (
          <div className="flex max-h-[80dvh] flex-col gap-3 p-5">
            <h2 className="m-0 text-xl font-extrabold">Hand {selected.handNumber}</h2>
            <div className="overflow-y-auto">
              {handLog(selected.events, selected.names).map((line) => (
                <div
                  key={line.id}
                  className="flex gap-3 border-t border-line py-2 text-[15px] leading-snug"
                >
                  <span className="w-[72px] flex-none font-semibold text-ink-2">{line.street}</span>
                  <span>{line.text}</span>
                </div>
              ))}
            </div>
            <button type="button" className={button()} onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        )}
      </Sheet>
    </main>
  );
}
