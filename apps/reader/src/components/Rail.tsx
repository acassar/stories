import type { ColorMode } from '@embranche/design-tokens';

import { BrandMark, MoonIcon, SunIcon } from './Icons';
import { ImportButton } from './ImportButton';

interface Props {
  mode: ColorMode;
  onToggleMode: () => void;
  onImport: (file: File) => void;
}

/**
 * The left-hand rail of the wide layout.
 *
 * It carries what belongs to the reader rather than to the story being read:
 * the name of the app, the two settings. No menu — the reader has a single
 * destination, its library, and one always comes back to it through the story
 * one is leaving.
 */
export function Rail({ mode, onToggleMode, onImport }: Props) {
  return (
    <aside className="rail">
      <div className="rail__brand">
        <span className="rail__mark" style={{ color: 'var(--emb-accent)' }}>
          <BrandMark />
        </span>
        <span className="rail__name">Embranche</span>
      </div>

      <div className="rail__spacer" />

      <div className="rail__actions">
        <ImportButton onImport={onImport} className="rail__button" label="Ouvrir un fichier" />
        <button
          type="button"
          className="rail__button"
          onClick={onToggleMode}
          aria-label={mode === 'light' ? 'Passer en mode nuit' : 'Passer en mode jour'}
        >
          {mode === 'light' ? <SunIcon /> : <MoonIcon />}
          <span className="rail__button-label">Jour / nuit</span>
        </button>
      </div>
    </aside>
  );
}
