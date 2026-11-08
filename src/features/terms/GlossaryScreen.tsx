import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { GLOSSARY, TERM_CATEGORIES, type TermCategory } from '@/curriculum/glossary';
import { dashboardQuery } from '@/db/queries';
import { openTerm } from '@/features/terms/term-store';
import { localDay } from '@/learning/days';

type Status = 'Learned' | 'Review' | 'New';

const STATUS_COLOR: Record<Status, string> = {
  Learned: 'text-green',
  Review: 'text-red',
  New: 'text-ink-2',
};

export function GlossaryScreen() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<TermCategory | 'all'>('all');

  const today = localDay(new Date());
  const mastery = new Map(data.mastery.map((entry) => [entry.skillId, entry]));
  const statusOf = (id: string): Status => {
    const entry = mastery.get(`term:${id}`);
    if (!entry) return 'New';
    return entry.dueDay <= today ? 'Review' : 'Learned';
  };

  const query = search.trim().toLowerCase();
  const matches = GLOSSARY.filter(
    (term) =>
      (category === 'all' || term.category === category) &&
      (query === '' ||
        term.term.toLowerCase().includes(query) ||
        term.short.toLowerCase().includes(query) ||
        term.abbreviation?.toLowerCase() === query),
  );

  const filters = [{ id: 'all', label: 'All' } as const, ...TERM_CATEGORIES];

  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-3 p-5 lg:p-8">
      <h1 className="m-0 text-[28px] leading-tight font-extrabold">Glossary</h1>

      <input
        type="search"
        aria-label="Search terms"
        placeholder="Search terms"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="min-h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-base text-ink"
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={category === filter.id}
            onClick={() => setCategory(filter.id)}
            className={`min-h-11 flex-none rounded-full border px-3.5 text-sm font-semibold ${
              category === filter.id
                ? 'border-ink bg-ink text-on-ink'
                : 'border-line bg-surface text-ink'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {TERM_CATEGORIES.map((group) => {
        const terms = matches
          .filter((term) => term.category === group.id)
          .sort((a, b) => a.term.localeCompare(b.term));
        if (terms.length === 0) return null;
        return (
          <section key={group.id} className="flex flex-col">
            <h2 className="m-0 mb-1 text-[13px] font-bold text-ink-2">{group.label}</h2>
            {terms.map((term) => {
              const status = statusOf(term.id);
              return (
                <button
                  key={term.id}
                  type="button"
                  onClick={() => openTerm({ id: term.id, source: 'glossary' })}
                  className="flex min-h-[60px] items-center gap-3 border-0 border-t border-solid border-line bg-transparent py-1.5 text-left text-ink"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold">{term.term}</span>
                    <span className="block text-sm leading-tight text-ink-2">{term.short}</span>
                  </span>
                  <span className={`flex-none text-[13px] font-semibold ${STATUS_COLOR[status]}`}>
                    {status}
                  </span>
                </button>
              );
            })}
          </section>
        );
      })}

      {matches.length === 0 && <p className="text-base text-ink-2">No terms match that search.</p>}
    </main>
  );
}
