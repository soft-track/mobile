import { NO_FILTERS, sameFilters } from '@/board/filters';
import { fromViewFilters, toViewFilters } from '@/views/saved-views';

describe('saved view filters', () => {
  it('round-trips every filter a board can carry', () => {
    const filters = {
      statusId: 3,
      priority: 'high' as const,
      assignee: 7,
      labelId: 2,
      projectId: 9,
      cycleId: 4,
    };
    expect(sameFilters(fromViewFilters(toViewFilters(filters)), filters)).toBe(true);
  });

  it('stores unassigned as the flag the API actually has', () => {
    // A view stores assignee_id and unassigned side by side; the board models
    // them as one question, so the flag has to win on the way back.
    const stored = toViewFilters({ ...NO_FILTERS, assignee: 'unassigned' });
    expect(stored.unassigned).toBe(true);
    expect(stored.assignee_id).toBeNull();
    expect(fromViewFilters(stored).assignee).toBe('unassigned');
  });

  it('treats a view with no filters as showing everything', () => {
    // Which is what makes an empty saved view sensible rather than a view that
    // matches nothing.
    expect(sameFilters(fromViewFilters({}), NO_FILTERS)).toBe(true);
  });

  it('prefers the unassigned flag over a stale assignee id', () => {
    expect(fromViewFilters({ unassigned: true, assignee_id: 5 }).assignee).toBe('unassigned');
  });
});
