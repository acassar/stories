import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import type { ColorMode } from '@embranche/design-tokens';
import { waitStatus } from '@embranche/story-engine';
import { languageOf } from '@embranche/story-format';
import type { GameState, SceneSection, Story } from '@embranche/story-format';

import { BackIcon, MoonIcon, PaceIcon, ReadOnIcon, SunIcon } from '../components/Icons';
import { usePrefersReducedMotion } from '../hooks/useColorMode';
import type { LayoutKind } from '../hooks/useLayoutKind';
import { useMessages } from '../hooks/useMessages';
import { useNow } from '../hooks/useNow';
import { REVEAL_TIMING, useReveal } from '../hooks/useReveal';
import { WRITING_TIMING, useTypewriter } from '../hooks/useTypewriter';
import { useStory } from '../hooks/useStory';
import { awaySentence, awayStatus } from '../lib/away';
import type { Pace } from '../lib/settings';
import { buildTranscript } from '../lib/transcript';
import { Ending } from './Ending';

/** Text hidden below the page, in pixels, small enough to count as read. */
const READ_ON_SLACK = 24;

interface Props {
  story: Story;
  /** Save to resume, or `null` for a fresh run. */
  initialState: GameState | null;
  endingsSeen: number;
  /** How fast the waits of the story run for this reader. */
  pace: Pace;
  mode: ColorMode;
  layout: LayoutKind;
  onToggleMode: () => void;
  onSettings: () => void;
  onLeave: () => void;
  onStateChange: (state: GameState) => void;
  onEndingReached: (sceneId: string) => void;
}

/**
 * Reading a story, as a correspondence or as a book — whichever its author chose.
 *
 * The screen knows nothing of the story: it reads the engine snapshot and shows
 * what it is given. The only local logic is the progressive arrival of the
 * lines, which is staging, not a game rule. The two styles share all of it —
 * the same lines arrive at the same moments; only how they are set differs.
 */
export function Reading({
  story,
  initialState,
  endingsSeen,
  pace,
  mode,
  layout,
  onToggleMode,
  onSettings,
  onLeave,
  onStateChange,
  onEndingReached,
}: Props) {
  const { state, scene, canGoBack, decisions, choose, advance, goBack, restart } = useStory({
    story,
    initialState,
    onStateChange,
  });

  const t = useMessages();
  const reduceMotion = usePrefersReducedMotion();

  /**
   * Picking a run up again.
   *
   * The scene the reader stopped on has already been read: typing it out a
   * second time would make the story look as if it were starting over. It is
   * therefore the only scene of the session to arrive in one block — and only
   * on the way in. Coming back to it later, through `goBack`, it types itself
   * out like any other.
   */
  const resumedSceneId = useRef(initialState?.currentSceneId ?? null);
  const resuming = resumedSceneId.current === scene.id;
  useEffect(() => {
    if (resumedSceneId.current !== scene.id) resumedSceneId.current = null;
  }, [scene.id]);

  /*
   * The silence of the correspondent.
   *
   * Read, never stored: the state only knows when the silence started, so
   * moving the pace during one shortens or lengthens it on the spot, with
   * nothing to reschedule. The clock only ticks while it lasts.
   */
  const pending = Boolean(state.awaitingSince);
  const now = useNow(pending);
  const away = waitStatus(story, state, pace, now);

  // The author decides how the story is set: a thread of messages, or prose on a page.
  const book = story.readingStyle === 'book';

  /*
   * Two stagings, one per style. A correspondence types each message behind
   * three dots, then shows it whole; a book writes itself letter by letter,
   * with nobody announcing the next line. Both hooks run, so the order of hooks
   * never depends on the story — the one not in use is told not to animate,
   * and has already revealed everything.
   */
  const texts = scene.blocks.map((block) => block.text);
  const animate = !reduceMotion && !resuming;
  const bubbles = useReveal(scene.id, texts, animate && !book, away.waiting);
  const pen = useTypewriter(scene.id, texts, animate && book);
  const reveal = book ? { ...pen, typing: false } : { ...bubbles, written: 0 };
  const thread = useRef<HTMLUListElement>(null);

  /**
   * Automatic chaining.
   *
   * When the current node awaits no decision, the story carries on by itself —
   * but only once its messages have arrived, and after the same silence as
   * between two messages. That is what makes a forced player line, or two lines
   * in a row from the correspondent, read as a real conversation rather than as
   * a block dropping all at once. A book takes the breath it takes between two
   * of its lines.
   */
  useEffect(() => {
    if (!reveal.done || !scene.canAdvance) return;
    const pause = book ? WRITING_TIMING.line : REVEAL_TIMING.pause;
    const timer = setTimeout(advance, reduceMotion ? 0 : pause);
    return () => clearTimeout(timer);
  }, [reveal.done, scene.canAdvance, scene.id, advance, reduceMotion, book]);

  // A conversation always follows its latest message.
  useEffect(() => {
    if (book) return;
    thread.current?.scrollTo({
      top: thread.current.scrollHeight,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [reveal.revealed, reveal.typing, state.history.length, reduceMotion, book]);

  /*
   * A book stays where its reader is.
   *
   * Following the pen would slide the line being read up and out from under the
   * eyes, letter after letter. So the page never moves by itself — except once,
   * on the way in, to land a resumed run where it stopped — and a sign says when
   * the text goes on below the fold.
   */
  const [textBelow, setTextBelow] = useState(false);
  const measure = useCallback(() => {
    const page = thread.current;
    if (!page) return;
    setTextBelow(page.scrollHeight - page.scrollTop - page.clientHeight > READ_ON_SLACK);
  }, []);

  useEffect(() => {
    if (!book) return;
    thread.current?.scrollTo({ top: thread.current.scrollHeight });
    // Only on the way in — `book` does not change during a session, the screen
    // is remounted for another story. Afterwards, the reader holds the page.
  }, [book]);

  useEffect(() => {
    if (book) measure();
  }, [book, measure, reveal.revealed, reveal.written, state.history.length]);

  // One screen at a time, minus a few lines kept in view to read on from.
  const readOn = () => {
    const page = thread.current;
    if (!page) return;
    page.scrollBy({ top: page.clientHeight * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  /*
   * Not while the correspondent is away. The engine stands on the last scene,
   * but nothing of it has been sent: recording the ending there would tick it
   * off the player's record and release their save — deleting a run in the
   * middle of the silence it was waiting out.
   */
  const reachedEnding = !away.waiting && scene.isEnding && scene.ending;
  useEffect(() => {
    if (reachedEnding) onEndingReached(scene.id);
    // `onEndingReached` is stable on the App side; only the scene should trigger.
  }, [reachedEnding, scene.id, onEndingReached]);

  /*
   * The ending screen is opened, never imposed.
   *
   * The last message of a story is still a message: swapping the screen the
   * instant it lands means nobody ever reads it. The reader presses when they
   * have finished reading, and can come back to the conversation afterwards —
   * an ending is a place one leaves from, not a door that locks.
   */
  const [showEnding, setShowEnding] = useState(false);
  useEffect(() => {
    if (!scene.isEnding) setShowEnding(false);
  }, [scene.id, scene.isEnding]);

  if (scene.isEnding && scene.ending && showEnding) {
    return (
      <Ending
        story={story}
        ending={scene.ending}
        endingsSeen={endingsSeen}
        steps={decisions}
        mode={mode}
        onRestart={restart}
        onReread={() => setShowEnding(false)}
        rereadLabel={story.readingStyle === 'book' ? t.rereadBook : t.rereadCorrespondence}
        onLibrary={onLeave}
      />
    );
  }

  const messages = buildTranscript(story, state, scene, { revealed: reveal.revealed });
  const narrator = story.narrator;

  /*
   * The line the pen is on. It carries the key it will keep once written, and
   * sits in the same list as the written ones, so finishing it changes a class
   * rather than replacing the element. It is hidden from assistive technology
   * while it grows — a screen reader would otherwise read it out letter by
   * letter — and joins the live region whole.
   */
  const section = story.scenes[scene.id]?.section;
  const lines =
    book && !reveal.done && reveal.written > 0
      ? [
          ...messages,
          {
            key: `${state.history.length}-${scene.id}-${reveal.revealed}`,
            text: Array.from(scene.blocks[reveal.revealed]?.text ?? '')
              .slice(0, reveal.written)
              .join(''),
            fromPlayer: scene.speaker === 'player',
            // The break opens with the first line, as the pen starts it.
            ...(reveal.revealed === 0 && section && { section }),
            writing: true,
          },
        ]
      : messages;

  return (
    <div className="reading">
      <header className="reading__head">
        {/* Leaving and undoing are two different intentions: this one always
            closes the story, whatever has been played. */}
        <button type="button" className="icon-btn" onClick={onLeave} aria-label={t.backToSheet}>
          <BackIcon />
        </button>
        {/* A book has a title on its spine, not someone on the other end. */}
        {!book && (
          <div className="avatar" aria-hidden="true">
            {(narrator?.name ?? story.title).charAt(0)}
          </div>
        )}
        <div className="reading__who">
          <div className="reading__name">
            {book ? story.title : (narrator?.name ?? story.title)}
          </div>
          <div className="reading__status">
            {away.waiting
              ? awayStatus(narrator, away.remainingMs, t)
              : book
                ? (story.tag ?? '')
                : reveal.typing
                  ? t.typing
                  : (narrator?.status ?? story.tag ?? '')}
          </div>
        </div>
        {layout === 'mobile' && (
          <>
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleMode}
              aria-label={mode === 'light' ? t.toNight : t.toDay}
            >
              {mode === 'light' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button type="button" className="icon-btn" onClick={onSettings} aria-label={t.settings}>
              <PaceIcon />
            </button>
          </>
        )}
      </header>

      <ul
        className={`thread${book ? ' thread--book' : ''}`}
        lang={languageOf(story)}
        ref={thread}
        aria-live="polite"
        aria-label={book ? t.threadBook : t.threadCorrespondence}
        // Tapping the conversation skips the wait: nobody should have to wait
        // for an animation to read on.
        onClick={reveal.skip}
        onScroll={book ? measure : undefined}
      >
        {lines.map((message) => (
          <Fragment key={message.key}>
            {message.section && <PartBreak section={message.section} book={book} />}
            {book ? (
              // Prose, one paragraph per block, the player's answers written
              // into it rather than sent.
              <li
                className={`prose${message.fromPlayer ? ' prose--player' : ''}${'writing' in message ? ' prose--writing' : ''}`}
                aria-hidden={'writing' in message ? true : undefined}
              >
                {message.text}
              </li>
            ) : (
              <li className={`bubble-row${message.fromPlayer ? ' bubble-row--player' : ''}`}>
                <div className={`bubble${message.fromPlayer ? ' bubble--player' : ''}`}>
                  {message.text}
                </div>
              </li>
            )}
          </Fragment>
        ))}

        {/*
          The silence is shown where the messages are, not only in the header:
          a thread that simply stops looks like an app that has stopped.
        */}
        {away.waiting && (
          <li className="bubble-row">
            <div className="away" aria-live="polite">
              {awaySentence(narrator, away.remainingMs, t)}
            </div>
          </li>
        )}

        {reveal.typing && (
          // The player "types" too: a forced line arrives on their side of the
          // conversation, not on the correspondent's.
          <li className={`bubble-row${scene.speaker === 'player' ? ' bubble-row--player' : ''}`}>
            <div className="typing" aria-label={t.typingLabel}>
              <span />
              <span />
              <span />
            </div>
          </li>
        )}
      </ul>

      <div className={`answers${book ? ' answers--book' : ''}`}>
        {/* The page does not follow the pen: this says there is more to read. */}
        {book && textBelow && (
          <button type="button" className="read-on" onClick={readOn} aria-label={t.readOn}>
            <ReadOnIcon />
          </button>
        )}

        {/* The answers keep the same column as the conversation above them. */}
        <div className="answers__column">
          {/* Undoing the last choice — the story steps back one bifurcation,
              it does not start over. Offered only where the reading stops: on
              a node that chains on, it would flash for the breath before the
              next line. */}
          {reveal.done && canGoBack && !scene.canAdvance && (
            <button type="button" className="undo" onClick={goBack}>
              {t.goBack}
            </button>
          )}

          {reveal.done && scene.isEnding && scene.ending && (
            <button type="button" className="cta" onClick={() => setShowEnding(true)}>
              {t.seeEnding}
            </button>
          )}

          {reveal.done && scene.choices.length > 0 && (
            <>
              <div className="answers__label">{book ? t.whatNext : t.reply}</div>
              {scene.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className="answer"
                  onClick={() => choose(choice.id)}
                >
                  {choice.label}
                </button>
              ))}
            </>
          )}

          {/*
          A true dead end: no choice to offer, no chaining to follow, no
          declared ending. A chaining node shows nothing — it moves on.
        */}
          {reveal.done && !scene.awaitsChoice && !scene.canAdvance && !scene.isEnding && (
            <div className="answers__label">{t.deadEnd}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Where a new part of the story opens: a chapter heading when it has a title,
 * a plain break otherwise. A book sets it on the page, between two paragraphs;
 * a correspondence sets it across the thread, the way a messaging app marks a
 * new day.
 */
function PartBreak({ section, book }: { section: SceneSection; book: boolean }) {
  const title = section.title?.trim();
  return (
    <li className={`part${book ? ' part--book' : ''}`} role={title ? undefined : 'separator'}>
      {title ? <h2 className="part__title">{title}</h2> : <span aria-hidden="true">⁂</span>}
    </li>
  );
}
