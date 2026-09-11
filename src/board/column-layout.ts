/**
 * Where the columns are, and which one a dropped card landed on.
 *
 * Split out from the gesture code and kept pure on purpose: hit-testing across
 * a horizontally scrolled strip is the part most likely to be subtly wrong, and
 * it is the only part that can be tested without a device.
 */

/** A column's position in the scroll content, not on screen. */
export type ColumnBounds = {
  statusId: number;
  /** Left edge, in content coordinates. */
  x: number;
  width: number;
};

/**
 * The column under a point.
 *
 * `pointerX` is a screen coordinate; `scrollX` converts it into the content
 * coordinate space the bounds were measured in, which is what makes this work
 * while the strip is scrolled or mid-auto-scroll.
 *
 * Falls back to the nearest column rather than nothing: a finger released a few
 * pixels into the gutter clearly meant the column beside it, and dropping the
 * card back where it started would read as the app ignoring the gesture.
 */
export function columnAt(
  columns: ColumnBounds[],
  pointerX: number,
  scrollX: number,
  boardOriginX = 0,
): number | null {
  if (columns.length === 0) return null;

  const contentX = pointerX - boardOriginX + scrollX;

  for (const column of columns) {
    if (contentX >= column.x && contentX < column.x + column.width) {
      return column.statusId;
    }
  }

  let nearest = columns[0];
  let bestDistance = Infinity;
  for (const column of columns) {
    const centre = column.x + column.width / 2;
    const distance = Math.abs(contentX - centre);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = column;
    }
  }
  return nearest.statusId;
}

/** How wide each column is at a given size class, per the mockups. */
export const COLUMN_GAP = 12;

export function columnWidth(sizeClass: 'compact' | 'medium' | 'expanded', boardWidth: number) {
  // Phone shows one column with its neighbours peeking, which is what says
  // "this strip scrolls sideways" without a scrollbar to point at.
  if (sizeClass === 'compact') return Math.round(boardWidth * 0.82);
  // The foldable's hinge is the column gutter: exactly two, never a card
  // straddling the seam.
  if (sizeClass === 'medium') return Math.round((boardWidth - COLUMN_GAP) / 2);
  // Tablet fits four; more than that and cards get too narrow to read.
  return Math.round((boardWidth - COLUMN_GAP * 3) / 4);
}

/**
 * How far to scroll when a lifted card is held near an edge.
 *
 * Returns pixels per frame, signed. Zero in the middle, so a card being dragged
 * between two visible columns does not drift the strip under it.
 */
export const EDGE_ZONE = 64;
export const EDGE_SPEED = 12;

export function edgeScrollStep(pointerX: number, boardOriginX: number, boardWidth: number): number {
  // Runs on the UI thread from the drag's frame callback, so that a card held
  // still against an edge keeps scrolling. Harmless on the JS thread, which is
  // where the tests call it.
  'worklet';
  const left = pointerX - boardOriginX;
  const right = boardOriginX + boardWidth - pointerX;
  if (left < EDGE_ZONE) return -EDGE_SPEED;
  if (right < EDGE_ZONE) return EDGE_SPEED;
  return 0;
}
