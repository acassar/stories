import { ReactFlowProvider } from '@xyflow/react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LinkEdge } from './LinkEdge';
import type { LinkEdgeData } from '../lib/graph';

/**
 * What the link actually puts on screen.
 *
 * `toEdges` is covered by its own tests, but they check the geometry, not that
 * anything is drawn: a path that comes out invisible — an unknown colour, a
 * class nothing styles — passes every one of them. Hence a render.
 *
 * Only what the link draws into its own layer is visible here. The mark for a
 * stretch running behind a card goes through React Flow's label layer, which
 * exists only inside a mounted canvas — `Editor.test` covers that one.
 */
function draw(data: Partial<LinkEdgeData>) {
  const full: LinkEdgeData = {
    pieces: ['M 0,0 L 0,100'],
    obscured: [],
    hit: 'M 0,0 L 0,100',
    label: { x: 0, y: 50 },
    dim: false,
    ...data,
  };
  const { container } = render(
    <ReactFlowProvider>
      <svg>
        <LinkEdge
          id="a:b"
          source="a"
          target="b"
          sourceX={0}
          sourceY={0}
          targetX={0}
          targetY={100}
          sourcePosition={'bottom' as never}
          targetPosition={'top' as never}
          data={full}
          style={{ stroke: '#123456' }}
        />
      </svg>
    </ReactFlowProvider>,
  );
  return container;
}

describe('LinkEdge', () => {
  it('draws the link, plus the ribbon that catches the clicks', () => {
    const container = draw({});
    expect(container.querySelectorAll('path.react-flow__edge-path')).toHaveLength(1);
    expect(container.querySelector('path.react-flow__edge-interaction')).not.toBeNull();
  });

  it('draws one piece per stretch left by the crossings it runs under', () => {
    const container = draw({ pieces: ['M 0,0 L 0,40', 'M 0,52 L 0,100'] });
    expect(container.querySelectorAll('path.react-flow__edge-path')).toHaveLength(2);
  });

  it('marks the stretches it shares with another link', () => {
    // The mark is the only thing telling the reader that one line carries two,
    // so it has to be on screen — and to carry the class that colours it.
    const container = draw({
      obscured: [{ path: 'M 0,20 L 0,60', at: { x: 0, y: 40 }, why: 'shared' }],
    });
    const shared = container.querySelectorAll('path.link-shared');

    expect(shared).toHaveLength(1);
    expect(shared[0]?.getAttribute('d')).toBe('M 0,20 L 0,60');
    expect(shared[0]?.querySelector('title')?.textContent).toContain('Deux liens');
  });

  it('keeps a stretch running behind a card out of its own layer', () => {
    // It belongs above the cards, and the link's layer is below them. So it is
    // handed to the label layer instead — and must not be drawn here as well,
    // where a card would hide the very mark saying a card hides something.
    const container = draw({
      obscured: [{ path: 'M 0,20 L 0,60', at: { x: 0, y: 40 }, why: 'behind' }],
    });
    expect(container.querySelectorAll('path.link-shared')).toHaveLength(0);
    expect(container.querySelectorAll('path.link-behind')).toHaveLength(0);
  });

  it('marks nothing when the link has a line to itself', () => {
    expect(draw({}).querySelectorAll('path.link-shared')).toHaveLength(0);
  });
});
