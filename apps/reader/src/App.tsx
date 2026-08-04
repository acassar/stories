import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveShell, tokensToCssVars } from '@embranche/design-tokens';
import type { StoryTheme } from '@embranche/design-tokens';
import { validateStory } from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';

import { useColorMode } from './hooks/useColorMode';
import {
  clearSave,
  loadEndings,
  loadLibrary,
  loadSave,
  recordEnding,
  saveImportedStory,
  writeSave,
} from './lib/library';
import { Detail } from './screens/Detail';
import { Library } from './screens/Library';
import { Reading } from './screens/Reading';

type Screen = 'library' | 'detail' | 'read';

/**
 * Coquille du lecteur : quelle histoire, quel ecran, quel mode.
 *
 * Toute la persistance passe par `lib/library` et est declenchee depuis ici —
 * le moteur, lui, ne sait pas que `localStorage` existe.
 */
export function App() {
  const [mode, toggleMode] = useColorMode();
  const [stories, setStories] = useState<Story[]>(() => loadLibrary());
  const [endings, setEndings] = useState<Record<string, string[]>>(() => loadEndings());
  const [screen, setScreen] = useState<Screen>('library');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /**
   * Une session de lecture est identifiee par ce jeton : le changer remonte un
   * moteur neuf. C'est ce qui distingue « reprendre » de « recommencer ».
   */
  const [session, setSession] = useState(0);
  const [resumeState, setResumeState] = useState<GameState | null>(null);

  const story = activeId ? stories.find((item) => item.id === activeId) : undefined;
  const theme = (story?.theme ?? 'night') as StoryTheme;
  const tokens = useMemo(() => resolveShell(theme, mode), [theme, mode]);

  // Les sauvegardes sont tenues a jour aux trois seuls moments ou elles
  // bougent : une partie avance, une partie est relancee, une histoire arrive.
  const [saves, setSaves] = useState<Record<string, GameState | null>>(() => readSaves(stories));

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleStateChange = useCallback((state: GameState) => {
    writeSave(state);
    setSaves((current) => ({ ...current, [state.storyId]: state }));
  }, []);

  const handleEndingReached = useCallback((sceneId: string) => {
    const storyId = activeIdRef.current;
    if (!storyId) return;
    setEndings(recordEnding(storyId, sceneId));
    // Une partie terminee n'est plus « en cours » : on libere la reprise.
    clearSave(storyId);
    setSaves((current) => ({ ...current, [storyId]: null }));
  }, []);

  const openStory = (storyId: string) => {
    setActiveId(storyId);
    setScreen('detail');
  };

  const start = (fresh: boolean) => {
    if (!activeId) return;
    if (fresh) {
      clearSave(activeId);
      setSaves((current) => ({ ...current, [activeId]: null }));
    }
    setResumeState(fresh ? null : loadSave(activeId));
    setSession((current) => current + 1);
    setScreen('read');
  };

  const handleImport = async (file: File) => {
    let data: unknown;
    try {
      data = JSON.parse(await readText(file));
    } catch {
      setToast('Ce fichier n’est pas du JSON lisible.');
      return;
    }
    const result = validateStory(data);
    if (!result.valid) {
      const first = result.issues.find((issue) => issue.severity === 'error');
      setToast(`Histoire refusée : ${first?.message ?? 'document incohérent'}`);
      return;
    }
    const imported = data as Story;
    saveImportedStory(imported);
    const library = loadLibrary();
    setStories(library);
    setSaves(readSaves(library));
    setToast(`« ${imported.title} » ajoutée à ta bibliothèque.`);
  };

  return (
    <div
      className="screen"
      style={{ ...tokensToCssVars(tokens), background: tokens.bg, color: tokens.ink }}
    >
      {screen === 'library' && (
        <Library
          stories={stories}
          endings={endings}
          saves={saves}
          mode={mode}
          onToggleMode={toggleMode}
          onOpen={openStory}
          onImport={(file) => void handleImport(file)}
        />
      )}

      {screen === 'detail' && story && (
        <Detail
          story={story}
          endingsSeen={endings[story.id]?.length ?? 0}
          hasSave={Boolean(saves[story.id])}
          mode={mode}
          onToggleMode={toggleMode}
          onBack={() => setScreen('library')}
          onResume={() => start(false)}
          onStart={() => start(true)}
        />
      )}

      {screen === 'read' && story && (
        <Reading
          // Remonter le composant a chaque session garantit un moteur neuf.
          key={`${story.id}-${session}`}
          story={story}
          initialState={resumeState}
          endingsSeen={endings[story.id]?.length ?? 0}
          mode={mode}
          onToggleMode={toggleMode}
          onLeave={() => setScreen('detail')}
          onStateChange={handleStateChange}
          onEndingReached={handleEndingReached}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function readSaves(library: Story[]): Record<string, GameState | null> {
  const map: Record<string, GameState | null> = {};
  for (const item of library) map[item.id] = loadSave(item.id);
  return map;
}

/** `Blob.text()` manque encore sur quelques moteurs : repli `FileReader`. */
function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Lecture impossible'));
    reader.readAsText(file);
  });
}
