import { useEffect, useState } from 'react';

export type LayoutKind = 'mobile' | 'desktop';

/** Below this width the reader stays the phone app it was designed as. */
const DESKTOP_QUERY = '(min-width: 900px)';

/**
 * Which of the two layouts the reader is wearing.
 *
 * One switch, not a gradient: the phone stacks its screens and the desktop puts
 * a rail beside them. Everything in between is the phone layout, given more
 * room by the stylesheet.
 */
export function useLayoutKind(): LayoutKind {
  const [kind, setKind] = useState<LayoutKind>(() =>
    window.matchMedia(DESKTOP_QUERY).matches ? 'desktop' : 'mobile',
  );

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setKind(query.matches ? 'desktop' : 'mobile');
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return kind;
}
