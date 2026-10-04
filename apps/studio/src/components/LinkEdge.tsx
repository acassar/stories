import { EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

import type { LinkFlowEdge } from '../lib/graph';

/**
 * A link on the canvas.
 *
 * Deliberately dumb: the whole drawing — where the link leaves, where it lands,
 * where it is cut, where it disappears — was computed by `toEdges`, which is
 * the only place that sees every link and every card at once. Here there is
 * nothing left but to put it on screen.
 *
 * The path comes in pieces. A link drawn on top comes as a single one; a link
 * running underneath others comes broken at each crossing, and the breaks are
 * what makes the tangle readable — the line that stops is the line that passes
 * below, the way it has been drawn on paper for as long as there have been
 * wiring diagrams.
 */
export function LinkEdge({
  data,
  style,
  markerEnd,
  label,
  interactionWidth = 22,
}: EdgeProps<LinkFlowEdge>) {
  if (!data) return null;
  const { pieces, obscured, hit, label: at, dim } = data;
  const last = pieces.length - 1;
  const shared = obscured.filter((mark) => mark.why === 'shared');
  const behind = obscured.filter((mark) => mark.why === 'behind');

  return (
    <>
      {/*
        The ribbon that catches the clicks: the whole link, breaks included, so
        a link cut into four pieces is still picked up in one go — and picked up
        just as easily on the gap where it dives under another.
      */}
      <path
        className="react-flow__edge-interaction"
        d={hit}
        fill="none"
        stroke="transparent"
        strokeWidth={interactionWidth}
        strokeLinecap="butt"
      />
      {pieces.map((piece, index) => (
        <path
          key={index}
          className="react-flow__edge-path"
          d={piece}
          style={style}
          fill="none"
          strokeLinecap="round"
          // The arrow belongs to the end of the link, not to each of its parts.
          markerEnd={index === last ? markerEnd : undefined}
        />
      ))}

      {/*
        A stretch this link shares with another. Dotted and amber, so it reads
        neither as a conditional link — dashed, in the colour of what it leads
        to — nor as the break of a crossing: it is not a property of the story,
        it is the canvas admitting it could not separate two lines here.
      */}
      {shared.map((mark, index) => (
        <path
          key={`shared-${index}`}
          className="link-shared"
          d={mark.path}
          fill="none"
          opacity={dim ? 0.16 : 1}
        >
          <title>Deux liens sont dessinés sur cette portion</title>
        </path>
      ))}

      {/*
        A stretch that runs under a card.

        Drawn through the label layer rather than beside the link, because that
        layer is the only one above the cards: a mark for something hidden by a
        card, drawn under that same card, would be hidden along with it. Lighter
        than the shared mark, since here the line is merely covered — it does
        exist, and the reader only needs to see where it went.
      */}
      {behind.length > 0 && (
        <EdgeLabelRenderer>
          <svg className="link-behind__layer" aria-hidden="true">
            {behind.map((mark, index) => (
              <path
                key={`behind-${index}`}
                className="link-behind"
                d={mark.path}
                fill="none"
                opacity={dim ? 0.16 : 1}
              />
            ))}
          </svg>
        </EdgeLabelRenderer>
      )}

      {label && (
        <EdgeLabelRenderer>
          <div
            className={`link-label${dim ? ' link-label--dim' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
