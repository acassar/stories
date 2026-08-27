import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveShell, tokensToCssVars } from '@embranche/design-tokens';
import type { StoryTheme } from '@embranche/design-tokens';
import { waitStatus } from '@embranche/story-engine';
import { validateStory } from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';

import { Rail } from './components/Rail';
import { Settings } from './components/Settings';
import { useColorMode } from './hooks/useColorMode';
import { useLayoutKind } from './hooks/useLayoutKind';
import { useSpeed } from './hooks/useSpeed';
import { awaySentence } from './lib/away';
import {
  clearSave,
  loadEndings,
  loadLibrary,
  loadSave,
  recordEnding,
  removeStory,
  saveImportedStory,
  writeSave,
} from './lib/library';
import { Detail } from './screens/Detail';
import { Library } from './screens/Library';
import { Reading } from './screens/Reading';

type Screen = 'library' | 'detail' | 'read';

/**
 * Reader shell: which story, which screen, which mode.
 *
 * All persistence goes through `lib/library` and is triggered from here — the
 * engine does not know `localStorage` exists.
 */
export function App() {
  const [mode, toggleMode] = useColorMode();
  const [pace, setPace] = useSpeed();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const layout = useLayoutKind();
  const [stories, setStories] = useState<Story[]>(() => loadLibrary());
  const [endings, setEndings] = useState<Record<string, string[]>>(() => loadEndings());
  const [screen, setScreen] = useState<Screen>('library');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /**
   * A reading session is identified by this token: changing it mounts a fresh
   * engine. That is what separates "resume" from "start over".
   */
  const [session, setSession] = useState(0);
  const [resumeState, setResumeState] = useState<GameState | null>(null);

  const story = activeId ? stories.find((item) => item.id === activeId) : undefined;
  const theme = (story?.theme ?? 'night') as StoryTheme;
  const tokens = useMemo(() => resolveShell(theme, mode), [theme, mode]);

  // Saves are kept up to date at the only three moments they move: a run
  // advances, a run is restarted, a story arrives.
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
    // A finished run is no longer "in progress": the resume slot is released.
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

  const handleRemove = (storyId: string) => {
    const story = stories.find((item) => item.id === storyId);
    removeStory(storyId);
    const library = loadLibrary();
    setStories(library);
    setSaves(readSaves(library));
    setEndings(loadEndings());
    setActiveId(null);
    setScreen('library');
    setToast(`« ${story?.title ?? 'Ce récit'} » a quitté ta bibliothèque.`);
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
      className={`screen screen--${layout}`}
      style={{ ...tokensToCssVars(tokens), background: tokens.bg, color: tokens.ink }}
    >
      {layout === 'desktop' && (
        <Rail
          mode={mode}
          onToggleMode={toggleMode}
          onSettings={() => setSettingsOpen(true)}
          onImport={(file) => void handleImport(file)}
        />
      )}

      <main className="panel">
        {screen === 'library' && (
          <Library
            stories={stories}
            endings={endings}
            saves={saves}
            mode={mode}
            layout={layout}
            onToggleMode={toggleMode}
            onSettings={() => setSettingsOpen(true)}
            onOpen={openStory}
            onImport={(file) => void handleImport(file)}
          />
        )}

        {screen === 'detail' && story && (
          <Detail
            story={story}
            endingsSeen={endings[story.id]?.length ?? 0}
            hasSave={Boolean(saves[story.id])}
            away={awayLine(story, saves[story.id], pace)}
            mode={mode}
            layout={layout}
            onToggleMode={toggleMode}
            onBack={() => setScreen('library')}
            onResume={() => start(false)}
            onStart={() => start(true)}
            onRemove={() => handleRemove(story.id)}
          />
        )}

        {screen === 'read' && story && (
          <Reading
            // Remounting the component per session guarantees a fresh engine.
            key={`${story.id}-${session}`}
            story={story}
            initialState={resumeState}
            endingsSeen={endings[story.id]?.length ?? 0}
            pace={pace}
            mode={mode}
            layout={layout}
            onToggleMode={toggleMode}
            onSettings={() => setSettingsOpen(true)}
            onLeave={() => setScreen('detail')}
            onStateChange={handleStateChange}
            onEndingReached={handleEndingReached}
          />
        )}
      </main>

      {settingsOpen && (
        <Settings pace={pace} onChoose={setPace} onClose={() => setSettingsOpen(false)} />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/**
 * What the story sheet says about a correspondent who has not come back yet.
 *
 * Read once, on entering the screen: a sheet is a place one passes through, and
 * a countdown ticking there would be a timer running for nobody.
 */
function awayLine(story: Story, save: GameState | null | undefined, pace: number): string | null {
  if (!save) return null;
  const status = waitStatus(story, save, pace, Date.now());
  return status.waiting ? awaySentence(story.narrator, status.remainingMs) : null;
}

function readSaves(library: Story[]): Record<string, GameState | null> {
  const map: Record<string, GameState | null> = {};
  for (const item of library) map[item.id] = loadSave(item.id);
  return map;
}

/** `Blob.text()` is still missing on a few engines: `FileReader` fallback. */
function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Lecture impossible'));
    reader.readAsText(file);
  });
}
