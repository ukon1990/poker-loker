import { parseText } from '@/curriculum/text';
import { type OpenTerm, openTerm } from '@/features/terms/term-store';

export function TermLink({
  id,
  source = 'lesson',
  context,
  children,
  className = '',
}: {
  id: string;
  source?: OpenTerm['source'];
  context?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`term-link inline bg-transparent p-0 font-[inherit] ${className}`}
      onClick={() => openTerm({ id, source, context })}
    >
      {children}
    </button>
  );
}

/** Renders text, turning marks such as `{flush}` into tappable glossary links. */
export function RichText({ text, source }: { text: string; source?: OpenTerm['source'] }) {
  return (
    <>
      {parseText(text).map((part, index) =>
        part.type === 'text' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a text never reorder.
          <span key={index}>{part.text}</span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a text never reorder.
          <TermLink key={index} id={part.id} source={source}>
            {part.text}
          </TermLink>
        ),
      )}
    </>
  );
}
