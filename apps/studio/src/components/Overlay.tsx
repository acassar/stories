import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Accessible name of the dialog. */
  label: string;
  onClose: () => void;
}

/**
 * Modal layer shared by the playtest and the variables sheet: click outside or
 * press Escape to leave. Nothing else — a dialog that traps the author is a
 * dialog they will avoid opening.
 */
export function Overlay({ children, label, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="drawer"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
