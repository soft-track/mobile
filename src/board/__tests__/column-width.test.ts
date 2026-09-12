import { columnWidth, COLUMN_GAP } from '@/board/column-layout';
import { RAIL_WIDTH } from '@/ui/tab-bar';

/**
 * Column sizing from the width the board actually gets.
 *
 * These exist because running the app turned up a board whose columns were two
 * pixels wide: the width came from an async measurement that resolves to zero,
 * and every column -- and so every card -- collapsed to nothing while the DOM
 * still held all the content. A zero must never reach `columnWidth`.
 */
describe('columnWidth against the real viewports', () => {
  it('leaves the neighbours peeking on a phone', () => {
    // 390 phone, no rail. The peek is what says the strip scrolls sideways.
    expect(columnWidth('compact', 390)).toBe(320);
  });

  it('fits exactly two beside the rail on a foldable', () => {
    // 700 window less the 76 rail is the pane the columns actually get.
    const pane = 700 - RAIL_WIDTH;
    const width = columnWidth('medium', pane);
    expect(width).toBe(306);
    expect(width * 2 + COLUMN_GAP).toBe(pane);
  });

  it('fits exactly four beside the rail on a tablet', () => {
    const pane = 1280 - RAIL_WIDTH;
    const width = columnWidth('expanded', pane);
    expect(width).toBe(292);
    expect(width * 4 + COLUMN_GAP * 3).toBe(pane);
  });

  it('never returns something a card can disappear into', () => {
    // The regression itself: a zero or negative available width used to make
    // a column two pixels wide, borders only.
    for (const size of ['compact', 'medium', 'expanded'] as const) {
      expect(columnWidth(size, 0)).toBeLessThanOrEqual(0);
    }
    // Which is why the caller substitutes the window width rather than
    // passing a measurement through unchecked.
    expect(columnWidth('compact', 390)).toBeGreaterThan(100);
  });
});
