import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Story } from '@embranche/story-format';

import { Dashboard } from './components/Dashboard';
import { Editor } from './components/Editor';
import { createLocalRepository, seedIfEmpty } from './lib/storage';

/**
 * Coquille du studio. Elle tient deux choses : quelle histoire est ouverte, et
 * la synchronisation avec le rangement local. Toute la logique d'edition vit
 * dans `lib/storyDoc`, toute la logique de recit dans les paquets du coeur.
 */
export function App() {
  const repository = useMemo(() => createLocalRepository(), []);
  const [stories, setStories] = useState<Story[]>(() => seedIfEmpty(repository));
  const [openId, setOpenId] = useState<string | null>(null);

  const openStory = openId ? stories.find((story) => story.id === openId) : undefined;

  // L'ecriture disque est repoussee : l'auteur tape vite, le disque n'a pas
  // besoin de suivre chaque frappe.
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

  // Filet de securite : ce qui est en attente part avant la fermeture d'onglet.
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
        <Editor story={openStory} onChange={saveStory} onBack={() => setOpenId(null)} />
      ) : (
        <Dashboard stories={stories} onOpen={setOpenId} onSave={saveStory} onDelete={deleteStory} />
      )}
    </div>
  );
}
