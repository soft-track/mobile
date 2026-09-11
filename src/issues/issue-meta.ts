import { IssuePriority, StatusCategory } from '@/api/generated/models';
import type { StatusRead } from '@/api/generated/models';
import type { Tokens } from '@/ui/tokens';

/**
 * Priority and category metadata, ported from `frontend/src/issues/issueMeta.ts`.
 *
 * The web reaches for CSS variables; here the colour has to come from the
 * resolved palette, so each lookup takes the tokens rather than naming one.
 */
export const PRIORITY_ORDER: IssuePriority[] = [
  IssuePriority.urgent,
  IssuePriority.high,
  IssuePriority.medium,
  IssuePriority.low,
  IssuePriority.no_priority,
];

export const PRIORITY_LABEL: Record<IssuePriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  no_priority: 'No priority',
};

export function priorityColor(priority: IssuePriority, t: Tokens): string {
  switch (priority) {
    case 'urgent':
      return t.priority.urgent;
    case 'high':
      return t.priority.high;
    case 'medium':
      return t.priority.medium;
    case 'low':
      return t.priority.low;
    default:
      return t.priority.none;
  }
}

/** Work that is finished, one way or the other. Mirrors RESOLVED in lib_softtrack/statuses.py. */
const RESOLVED: StatusCategory[] = [StatusCategory.done, StatusCategory.cancelled];

export function isResolved(status: StatusRead): boolean {
  return RESOLVED.includes(status.category);
}

/**
 * Columns in these categories start collapsed. Cancelled work is rarely what a
 * board is for, and on a phone it would cost a whole swipe to get past.
 *
 * By category rather than by name, because the columns are the team's own --
 * a team may well call it "Won't do".
 */
export const COLLAPSED_CATEGORIES: StatusCategory[] = [StatusCategory.cancelled];
