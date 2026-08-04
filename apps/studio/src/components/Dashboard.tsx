import { useRef, useState } from 'react';

import { accents } from '@embranche/design-tokens';
import type { StoryTheme } from '@embranche/design-tokens';
import { createEmptyStory, createId, validateStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import { countEndings, countScenes } from '../lib/storyDoc';
import { downloadStoryJson, importStoryFile } from '../lib/storage';

interface Props {
  stories: Story[];
  onOpen: (storyId: string) => void;
  onSave: (story: Story) => void;
  onDelete: (storyId: string) => void;
}

/** Tableau de bord createur : ajouter, ouvrir, dupliquer, importer, supprimer. */
export function Dashboard({ stories, onOpen, onSave, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? stories.filter((story) =>
        [story.title, story.author, story.tag].some((field) =>
          field?.toLowerCase().includes(needle),
        ),
      )
    : stories;

  const draftCount = stories.filter((story) => story.status !== 'published').length;

  const handleCreate = () => {
    const story = createEmptyStory({ title: 'Nouveau récit' });
    onSave(story);
    onOpen(story.id);
  };

  const handleDuplicate = (story: Story) => {
    onSave({
      ...structuredClone(story),
      id: createId('story'),
      title: `${story.title} (copie)`,
      status: 'draft',
    });
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    const result = await importStoryFile(file);
    if (result.error || !result.story) {
      setMessage(result.error ?? 'Import impossible.');
      return;
    }
    // Un import ne doit jamais ecraser silencieusement un recit existant.
    const clash = stories.some((story) => story.id === result.story?.id);
    const story = clash ? { ...result.story, id: createId('story') } : result.story;
    onSave(story);
    setMessage(`« ${story.title} » importée${clash ? ' sous un nouvel identifiant' : ''}.`);
  };

  return (
    <div className="panel">
      <div className="dash__head">
        <div>
          <div className="dash__title">Mes histoires</div>
          <div className="dash__subtitle">
            {stories.length} récit{stories.length > 1 ? 's' : ''} · {draftCount} brouillon
            {draftCount > 1 ? 's' : ''}
          </div>
        </div>
        <div className="app__spacer" />
        <div className="dash__search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="#9a8f7d" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="#9a8f7d" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher…"
            aria-label="Rechercher une histoire"
          />
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            void handleImport(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          Importer JSON
        </button>
        <button type="button" className="btn btn--primary" onClick={handleCreate}>
          ＋ Nouvelle histoire
        </button>
      </div>

      {message && (
        <div className="issues" role="status">
          <div className="issues__head">
            <span>{message}</span>
            <span className="app__spacer" />
            <button type="button" className="btn btn--small" onClick={() => setMessage(null)}>
              OK
            </button>
          </div>
        </div>
      )}

      <div className="dash__body">
        <div className="row row--head">
          <div>Histoire</div>
          <div>Statut</div>
          <div>Scènes</div>
          <div>Fins</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        {visible.length === 0 && (
          <div className="empty">
            {stories.length === 0
              ? 'Aucune histoire pour l’instant. Commence par en créer une.'
              : 'Aucune histoire ne correspond à cette recherche.'}
          </div>
        )}

        {visible.map((story) => {
          const errors = validateStory(story).issues.filter((i) => i.severity === 'error').length;
          const published = story.status === 'published';
          return (
            <div className="row row--story" key={story.id}>
              <div className="row__story">
                <div
                  className="row__cover"
                  style={{ background: accents[(story.theme ?? 'night') as StoryTheme].grad }}
                  aria-hidden="true"
                />
                <div style={{ minWidth: 0 }}>
                  <div className="row__name">{story.title}</div>
                  <div className="row__meta">
                    {story.tag ?? 'Sans genre'} · {story.author ?? 'anonyme'}
                    {errors > 0 && (
                      <span style={{ color: 'var(--st-danger)' }}> · {errors} erreur(s)</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <span className={`badge badge--${published ? 'published' : 'draft'}`}>
                  {published ? 'Publiée' : 'Brouillon'}
                </span>
              </div>
              <div className="row__num">{countScenes(story)}</div>
              <div className="row__num">{countEndings(story)}</div>
              <div className="row__actions">
                <button type="button" className="btn" onClick={() => onOpen(story.id)}>
                  Éditer
                </button>
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => downloadStoryJson(story)}
                  title="Exporter le JSON"
                  aria-label={`Exporter ${story.title}`}
                >
                  ⤓
                </button>
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => handleDuplicate(story)}
                  title="Dupliquer"
                  aria-label={`Dupliquer ${story.title}`}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="btn btn--icon btn--danger"
                  onClick={() => {
                    if (
                      window.confirm(`Supprimer « ${story.title} » ? Cette action est définitive.`)
                    ) {
                      onDelete(story.id);
                    }
                  }}
                  title="Supprimer"
                  aria-label={`Supprimer ${story.title}`}
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
