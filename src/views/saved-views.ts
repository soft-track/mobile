import type { ViewFilters } from '@/api/generated/models';
import type { BoardFilters } from '@/board/filters';

/**
 * Translating between the board's filters and the shape a saved view stores.
 *
 * Ported from `frontend/src/board/filters.ts` so a view created on either client
 * reads identically on the other -- which is the acceptance criterion for #14.
 */

/** A saved view's filters, as the board holds them. */
export function fromViewFilters(filters: ViewFilters): BoardFilters {
  return {
    statusId: filters.status_id ?? null,
    priority: filters.priority ?? null,
    // `unassigned` is a flag beside assignee_id in storage, and one value of
    // assignee in the board -- the flag wins, as it does server-side.
    assignee: filters.unassigned ? 'unassigned' : (filters.assignee_id ?? null),
    labelId: filters.label_id ?? null,
    projectId: filters.project_id ?? null,
    cycleId: filters.cycle_id ?? null,
  };
}

/** The board's filters, as a saved view stores them. */
export function toViewFilters(filters: BoardFilters): ViewFilters {
  return {
    status_id: filters.statusId,
    priority: filters.priority,
    assignee_id: typeof filters.assignee === 'number' ? filters.assignee : null,
    unassigned: filters.assignee === 'unassigned',
    label_id: filters.labelId,
    project_id: filters.projectId,
    cycle_id: filters.cycleId,
  };
}
