import type { ColorMode } from '@embranche/design-tokens';

import { BrandMark, MoonIcon, PaceIcon, SunIcon } from './Icons';
import { ImportButton } from './ImportButton';
import { useMessages } from '../hooks/useMessages';

interface Props {
  mode: ColorMode;
  onToggleMode: () => void;
  onSettings: () => void;
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
export function Rail({ mode, onToggleMode, onSettings, onImport }: Props) {
  const t = useMessages();
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
        <ImportButton onImport={onImport} className="rail__button" label={t.openFile} />
        <button
          type="button"
          className="rail__button"
          onClick={onToggleMode}
          aria-label={mode === 'light' ? t.toNight : t.toDay}
        >
          {mode === 'light' ? <SunIcon /> : <MoonIcon />}
          <span className="rail__button-label">{t.dayNight}</span>
        </button>
        <button type="button" className="rail__button" onClick={onSettings} aria-label={t.settings}>
          <PaceIcon />
          <span className="rail__button-label">{t.settings}</span>
        </button>
      </div>
    </aside>
  );
}
