import type {
  IssuePriority,
  ListIssuesTeamsTeamIdIssuesGetParams,
} from '@/api/generated/models';

/**
 * What the board is narrowed to.
 *
 * A port of `frontend/src/board/filters.ts`, deliberately keeping the same
 * query-string keys. Those end up in links people paste to each other, so a
 * board URL copied out of the web app narrows the same way here.
 *
 * Null everywhere means "all issues" rather than a filter matching nothing.
 * `unassigned` is a value of `assignee` rather than a flag beside it, because
 * "assigned to nobody" and "assigned to somebody" answer the same question.
 */
export type AssigneeFilter = number | 'unassigned' | null;

export type BoardFilters = {
  statusId: number | null;
  priority: IssuePriority | null;
  assignee: AssigneeFilter;
  labelId: number | null;
  projectId: number | null;
  cycleId: number | null;
};

export const NO_FILTERS: BoardFilters = {
  statusId: null,
  priority: null,
  assignee: null,
  labelId: null,
  projectId: null,
  cycleId: null,
};

/**
 * The query-string key for each filter. Short and stable, and identical to the
 * web's -- renaming one breaks every link already sent.
 */
const KEYS = {
  statusId: 'status',
  priority: 'priority',
  assignee: 'assignee',
  labelId: 'label',
  projectId: 'project',
  cycleId: 'cycle',
} as const;

const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'no_priority'];

/** expo-router hands params back as strings, or arrays when repeated. */
export type RouteParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function readNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  // A hand-edited or truncated link should fall back to "no filter" rather
  // than sending NaN to the API and earning a 422.
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** The filters a route is asking for. Anything unparseable is simply not a filter. */
export function fromParams(params: RouteParams): BoardFilters {
  const assignee = one(params[KEYS.assignee]);
  const priority = one(params[KEYS.priority]);

  return {
    // A status is a row id, so the same "unparseable means no filter" rule
    // covers a link naming a status another team deleted.
    statusId: readNumber(one(params[KEYS.statusId])),
    priority: priority && PRIORITIES.includes(priority) ? (priority as IssuePriority) : null,
    assignee: assignee === 'unassigned' ? 'unassigned' : readNumber(assignee),
    labelId: readNumber(one(params[KEYS.labelId])),
    projectId: readNumber(one(params[KEYS.projectId])),
    cycleId: readNumber(one(params[KEYS.cycleId])),
  };
}

/**
 * Filters as route params.
 *
 * Every key is present, with cleared ones as `undefined`: expo-router merges
 * `setParams` into the existing params rather than replacing them, so omitting
 * a cleared key would leave the old value in the URL.
 */
export function toParams(filters: BoardFilters): Record<string, string | undefined> {
  return {
    [KEYS.statusId]: filters.statusId === null ? undefined : String(filters.statusId),
    [KEYS.priority]: filters.priority ?? undefined,
    [KEYS.assignee]: filters.assignee === null ? undefined : String(filters.assignee),
    [KEYS.labelId]: filters.labelId === null ? undefined : String(filters.labelId),
    [KEYS.projectId]: filters.projectId === null ? undefined : String(filters.projectId),
    [KEYS.cycleId]: filters.cycleId === null ? undefined : String(filters.cycleId),
  };
}

/** The same filters as the issue list endpoint wants them. */
export function toQueryParams(
  filters: BoardFilters,
): ListIssuesTeamsTeamIdIssuesGetParams {
  return {
    status_id: filters.statusId ?? undefined,
    priority: filters.priority ?? undefined,
    assignee_id: typeof filters.assignee === 'number' ? filters.assignee : undefined,
    unassigned: filters.assignee === 'unassigned' ? true : undefined,
    label_id: filters.labelId ?? undefined,
    project_id: filters.projectId ?? undefined,
    cycle_id: filters.cycleId ?? undefined,
  };
}

export function activeCount(filters: BoardFilters): number {
  return Object.values(filters).filter((value) => value !== null).length;
}

export function isEmpty(filters: BoardFilters): boolean {
  return activeCount(filters) === 0;
}

export function sameFilters(a: BoardFilters, b: BoardFilters): boolean {
  return (
    a.statusId === b.statusId &&
    a.priority === b.priority &&
    a.assignee === b.assignee &&
    a.labelId === b.labelId &&
    a.projectId === b.projectId &&
    a.cycleId === b.cycleId
  );
}
