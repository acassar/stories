import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Story } from '@embranche/story-format';

import { Dashboard } from './components/Dashboard';
import { Editor } from './components/Editor';
import { createLocalRepository, seedIfEmpty } from './lib/storage';

/**
 * Studio shell. It holds two things: which story is open, and the
 * synchronization with local storage. All editing logic lives in
 * `lib/storyDoc`, all story logic in the core packages.
 */
export function App() {
  const repository = useMemo(() => createLocalRepository(), []);
  const [stories, setStories] = useState<Story[]>(() => seedIfEmpty(repository));
  const [openId, setOpenId] = useState<string | null>(null);

  const openStory = openId ? stories.find((story) => story.id === openId) : undefined;

  // The write is deferred: the author types fast, and storage does not need to
  // follow every keystroke.
  const pending = useRef<Story | null>(null);
  useEffect(() => {
    if (!pending.current) return;
    const timer = setTimeout(() => {
      if (pending.current) repository.save(pending.current);
      pending.current = null;
    }, 400);
    return () => clearTimeout(timer);
  }, [stories, repository]);

  const saveStory = useCallback((story: Story) => {
    pending.current = story;
    setStories((current) => {
      const index = current.findIndex((item) => item.id === story.id);
      if (index < 0) return [...current, story];
      return current.map((item) => (item.id === story.id ? story : item));
    });
  }, []);

  const deleteStory = useCallback(
    (storyId: string) => {
      repository.remove(storyId);
      setStories((current) => current.filter((story) => story.id !== storyId));
      setOpenId((current) => (current === storyId ? null : current));
    },
    [repository],
  );

  // Safety net: whatever is pending is flushed before the tab closes.
  useEffect(() => {
    const flush = () => {
      if (pending.current) repository.save(pending.current);
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      flush();
      window.removeEventListener('beforeunload', flush);
    };
  }, [repository]);

  return (
    <div className="app">
      <header className="app__brand">
        <div className="app__mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="6" cy="5" r="2.4" fill="#eee6d6" />
            <circle cx="18" cy="11" r="2.4" fill="#eee6d6" />
            <circle cx="8" cy="19" r="2.4" fill="#eee6d6" />
            <path
              d="M7.6 6.4 16.4 10M16 12.6 9.2 17.6"
              stroke="#eee6d6"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity=".8"
            />
          </svg>
        </div>
        <div className="app__title">Embranche</div>
        <div className="app__tag">studio</div>
        <div className="app__spacer" />
        <div className="section-label">
          {openStory ? '02 — Éditeur d’arbre de scènes' : '03 — Gestion des histoires'}
        </div>
      </header>

      {openStory ? (
        // Keyed on the story: opening another one starts a fresh editing
        // session, undo stack included.
        <Editor
          key={openStory.id}
          story={openStory}
          onChange={saveStory}
          onBack={() => setOpenId(null)}
        />
      ) : (
        <Dashboard stories={stories} onOpen={setOpenId} onSave={saveStory} onDelete={deleteStory} />
      )}
    </div>
  );
}
