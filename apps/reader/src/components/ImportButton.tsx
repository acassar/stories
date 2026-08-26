import { useRef } from 'react';

interface Props {
  onImport: (file: File) => void;
  className?: string;
  /** Shown next to the sign when there is room for it. */
  label?: string;
}

/**
 * Opening a story exported from the studio. The hidden input and the button
 * that drives it travel together — the phone topbar and the desktop rail both
 * need them.
 */
export function ImportButton({ onImport, className = 'icon-btn', label }: Props) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          // Choosing the same file twice in a row must fire the change again.
          event.target.value = '';
        }}
      />
      <button
        type="button"
        className={className}
        onClick={() => input.current?.click()}
        aria-label="Ouvrir une histoire depuis un fichier"
      >
        <span aria-hidden="true">＋</span>
        {label && <span className="rail__button-label">{label}</span>}
      </button>
    </>
  );
}
