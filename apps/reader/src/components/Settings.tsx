import { useEffect } from 'react';

import { useMessages } from '../hooks/useMessages';
import { LOCALES } from '../lib/i18n';
import type { Locale } from '../lib/i18n';
import { languageName } from '../lib/language';
import { allowedPaces } from '../lib/settings';
import type { Pace, Plan } from '../lib/settings';

interface Props {
  pace: Pace;
  plan?: Plan;
  onChoose: (pace: Pace) => void;
  locale: Locale;
  onLocale: (locale: Locale) => void;
  onClose: () => void;
}

/**
 * The reader's own settings — the language of the app and the pace of the
 * waits.
 *
 * It is a sheet rather than a screen because it belongs to nowhere in
 * particular: one opens it from the library or from a conversation, and lands
 * back exactly where one was. A story being read carries on behind it, and a
 * silence shortened from here is shortened on the spot.
 */
export function Settings({ pace, plan = 'free', onChoose, locale, onLocale, onClose }: Props) {
  const t = useMessages();
  const paces = allowedPaces(plan);

  // A sheet one opens with a thumb must also close without one.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={t.settings}
      onClick={onClose}
    >
      <div className="sheet__panel" onClick={(event) => event.stopPropagation()}>
        <h2 className="sheet__title">{t.appLanguage}</h2>
        {/* Each language named in itself: someone who cannot read the current
            one must still find their own. */}
        <div className="pace" role="radiogroup" aria-label={t.appLanguage}>
          {LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              lang={option}
              aria-checked={option === locale}
              className={`pace__option${option === locale ? ' pace__option--on' : ''}`}
              onClick={() => onLocale(option)}
            >
              {languageName(option)}
            </button>
          ))}
        </div>

        <h2 className="sheet__title">{t.paceTitle}</h2>
        <p className="sheet__hint">{t.paceHint}</p>

        <div className="pace" role="radiogroup" aria-label={t.paceLabel}>
          {paces.map((option) => (
            <button
              key={String(option)}
              type="button"
              role="radio"
              aria-checked={option === pace}
              className={`pace__option${option === pace ? ' pace__option--on' : ''}`}
              onClick={() => onChoose(option)}
            >
              {t.paces[String(option)] ?? String(option)}
            </button>
          ))}
        </div>

        <p className="sheet__hint">
          {pace === 1
            ? t.paceRealTime
            : pace === Infinity
              ? t.paceNone
              : t.paceRatio(Math.round(60 / pace))}
        </p>

        <button type="button" className="cta" onClick={onClose}>
          {t.gotIt}
        </button>
      </div>
    </div>
  );
}
