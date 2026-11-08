import { type ReactNode, useEffect, useRef } from 'react';

/** A bottom sheet on phones and a centred panel on larger screens. */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled natively by the dialog element.
    <dialog
      ref={ref}
      className="sheet"
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog itself, rather than its content, is on the backdrop.
        if (event.target === ref.current) onClose();
      }}
    >
      {open && children}
    </dialog>
  );
}
