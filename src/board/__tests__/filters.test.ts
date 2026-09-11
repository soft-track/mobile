import {
  activeCount,
  fromParams,
  isEmpty,
  NO_FILTERS,
  sameFilters,
  toParams,
  toQueryParams,
} from '@/board/filters';

describe('fromParams', () => {
  it('reads every filter a link can carry', () => {
    expect(
      fromParams({
        status: '3',
        priority: 'urgent',
        assignee: '7',
        label: '2',
        project: '9',
        cycle: '4',
      }),
    ).toEqual({
      statusId: 3,
      priority: 'urgent',
      assignee: 7,
      labelId: 2,
      projectId: 9,
      cycleId: 4,
    });
  });

  it('treats unassigned as an answer, not an absent filter', () => {
    // "assigned to nobody" and "assigned to somebody" answer the same question,
    // which is why it is a value of assignee rather than a flag beside it.
    expect(fromParams({ assignee: 'unassigned' }).assignee).toBe('unassigned');
  });

  it('is unfiltered when the link says nothing', () => {
    expect(fromParams({})).toEqual(NO_FILTERS);
  });

  it('ignores values a hand-edited link could carry', () => {
    // Falling back to "no filter" rather than sending NaN and earning a 422.
    expect(
      fromParams({
        status: 'abc',
        priority: 'catastrophic',
        assignee: '-1',
        label: '0',
        project: '1.5',
        cycle: '',
      }),
    ).toEqual(NO_FILTERS);
  });

  it('takes the first value when a key is repeated', () => {
    expect(fromParams({ status: ['3', '5'] }).statusId).toBe(3);
  });
});

describe('toParams', () => {
  it('clears a dropped filter rather than leaving it in the URL', () => {
    // expo-router MERGES setParams into the existing params, so a cleared key
    // has to be present as undefined or its old value survives.
    const params = toParams({ ...NO_FILTERS, priority: 'high' });
    expect(params.priority).toBe('high');
    expect(params).toHaveProperty('status');
    expect(params.status).toBeUndefined();
  });

  it('round-trips through fromParams', () => {
    const filters = {
      statusId: 3,
      priority: 'low' as const,
      assignee: 'unassigned' as const,
      labelId: 2,
      projectId: 9,
      cycleId: 4,
    };
    const params = toParams(filters);
    const defined = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    );
    expect(fromParams(defined)).toEqual(filters);
  });
});

describe('toQueryParams', () => {
  it('sends only the filters that are set', () => {
    expect(toQueryParams({ ...NO_FILTERS, labelId: 4 })).toEqual({
      status_id: undefined,
      priority: undefined,
      assignee_id: undefined,
      unassigned: undefined,
      label_id: 4,
      project_id: undefined,
      cycle_id: undefined,
    });
  });

  it('maps unassigned onto the flag the API actually has', () => {
    // The backend takes `unassigned=true`, which overrides assignee_id, rather
    // than a sentinel assignee id.
    const params = toQueryParams({ ...NO_FILTERS, assignee: 'unassigned' });
    expect(params.unassigned).toBe(true);
    expect(params.assignee_id).toBeUndefined();
  });

  it('sends a real assignee as an id', () => {
    const params = toQueryParams({ ...NO_FILTERS, assignee: 12 });
    expect(params.assignee_id).toBe(12);
    expect(params.unassigned).toBeUndefined();
  });
});

describe('activeCount / isEmpty / sameFilters', () => {
  it('counts only what narrows the board', () => {
    expect(activeCount(NO_FILTERS)).toBe(0);
    expect(isEmpty(NO_FILTERS)).toBe(true);
    expect(activeCount({ ...NO_FILTERS, priority: 'urgent', labelId: 1 })).toBe(2);
  });

  it('compares the question, not the object', () => {
    expect(sameFilters(NO_FILTERS, { ...NO_FILTERS })).toBe(true);
    expect(sameFilters(NO_FILTERS, { ...NO_FILTERS, cycleId: 1 })).toBe(false);
  });
});
