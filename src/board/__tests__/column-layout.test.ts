import {
  columnAt,
  columnWidth,
  edgeScrollStep,
  EDGE_SPEED,
  type ColumnBounds,
} from '@/board/column-layout';

/** Three 200-wide columns with a 12 gutter, as the strip would lay them out. */
const COLUMNS: ColumnBounds[] = [
  { statusId: 1, x: 0, width: 200 },
  { statusId: 2, x: 212, width: 200 },
  { statusId: 3, x: 424, width: 200 },
];

describe('columnAt', () => {
  it('finds the column under the finger when nothing is scrolled', () => {
    expect(columnAt(COLUMNS, 100, 0)).toBe(1);
    expect(columnAt(COLUMNS, 300, 0)).toBe(2);
    expect(columnAt(COLUMNS, 500, 0)).toBe(3);
  });

  it('accounts for the strip being scrolled', () => {
    // The whole point: a drop at the same screen x means a different column
    // once the strip has moved under it.
    expect(columnAt(COLUMNS, 100, 0)).toBe(1);
    expect(columnAt(COLUMNS, 100, 212)).toBe(2);
    expect(columnAt(COLUMNS, 100, 424)).toBe(3);
  });

  it('accounts for the board not starting at the screen edge', () => {
    // On a tablet the nav rail sits to the left, so screen x is offset.
    expect(columnAt(COLUMNS, 176, 0, 76)).toBe(1);
    expect(columnAt(COLUMNS, 376, 0, 76)).toBe(2);
  });

  it('snaps a drop in the gutter to the nearest column', () => {
    // A finger released a few pixels into the gap clearly meant the column
    // beside it; doing nothing would read as the app ignoring the gesture.
    expect(columnAt(COLUMNS, 205, 0)).toBe(1);
    expect(columnAt(COLUMNS, 210, 0)).toBe(2);
  });

  it('snaps a drop past either end to the end column', () => {
    expect(columnAt(COLUMNS, -80, 0)).toBe(1);
    expect(columnAt(COLUMNS, 5000, 0)).toBe(3);
  });

  it('has no answer when there are no columns', () => {
    expect(columnAt([], 100, 0)).toBeNull();
  });
});

describe('columnWidth', () => {
  it('leaves the neighbours peeking on a phone', () => {
    // That peek is the only thing saying the strip scrolls sideways.
    const width = columnWidth('compact', 390);
    expect(width).toBeLessThan(390);
    expect(width).toBe(320);
  });

  it('fits exactly two on a foldable, so nothing straddles the hinge', () => {
    const width = columnWidth('medium', 700);
    expect(width * 2 + 12).toBe(700);
  });

  it('fits exactly four on a tablet', () => {
    const width = columnWidth('expanded', 1200);
    expect(width * 4 + 12 * 3).toBeCloseTo(1200, 0);
  });
});

describe('edgeScrollStep', () => {
  it('scrolls back when a card is held against the left edge', () => {
    expect(edgeScrollStep(10, 0, 400)).toBe(-EDGE_SPEED);
  });

  it('scrolls on when a card is held against the right edge', () => {
    expect(edgeScrollStep(390, 0, 400)).toBe(EDGE_SPEED);
  });

  it('stays still in the middle, so a drag between two visible columns does not drift', () => {
    expect(edgeScrollStep(200, 0, 400)).toBe(0);
  });

  it('measures the edges from the board, not the screen', () => {
    // With a nav rail at 76, the board's own left edge is where scrolling starts.
    expect(edgeScrollStep(86, 76, 400)).toBe(-EDGE_SPEED);
    expect(edgeScrollStep(200, 76, 400)).toBe(0);
  });
});
