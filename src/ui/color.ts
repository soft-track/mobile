import type { Tokens } from '@/ui/tokens';

/**
 * Turning a colour the server stored into one React Native can paint.
 *
 * Statuses, labels and projects carry a colour chosen through the web app, and
 * the web is happy to store a CSS custom property -- production has a
 * user-created status whose colour is the literal string
 * `var(--color-status-progress)`. A browser resolves that; React Native does
 * not, and hands back an invisible or black swatch instead.
 *
 * So every server-provided colour is resolved here rather than passed straight
 * to a style. Known variables map onto the same token the web would have
 * resolved them to, which is what keeps the two clients showing the same
 * colour; anything unrecognisable falls back to a visible neutral rather than
 * to nothing.
 */
const VAR_PATTERN = /^var\(\s*(--[a-z0-9-]+)\s*(?:,[^)]*)?\)$/i;
const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function fromVariable(name: string, t: Tokens): string | null {
  const key = name.replace(/^--color-/, '');

  const status: Record<string, string> = {
    'status-backlog': t.status.backlog,
    'status-todo': t.status.todo,
    'status-progress': t.status.progress,
    'status-review': t.status.review,
    'status-done': t.status.done,
    'status-cancelled': t.status.cancelled,
  };
  if (status[key]) return status[key];

  const priority: Record<string, string> = {
    'priority-urgent': t.priority.urgent,
    'priority-high': t.priority.high,
    'priority-medium': t.priority.medium,
    'priority-low': t.priority.low,
    'priority-none': t.priority.none,
  };
  if (priority[key]) return priority[key];

  const accent: Record<string, string> = {
    'accent-sky': t.accent.sky,
    'accent-pink': t.accent.pink,
    'accent-mint': t.accent.mint,
    'accent-amber': t.accent.amber,
  };
  if (accent[key]) return accent[key];

  const ramp = /^(brand|neutral|danger)-(\d{2,3})$/.exec(key);
  if (ramp) {
    const [, family, step] = ramp;
    const shades =
      family === 'brand' ? t.brand : family === 'neutral' ? t.neutral : t.danger;
    const value = (shades as Record<string, string | undefined>)[step];
    if (value) return value;
  }

  return null;
}

/**
 * A paintable colour for `raw`, or the fallback when there is nothing usable.
 *
 * `rgb()`/`rgba()` are passed through because React Native understands them;
 * only CSS variables need translating.
 */
export function resolveColor(
  raw: string | null | undefined,
  t: Tokens,
  fallback?: string,
): string {
  const missing = fallback ?? t.neutral[400];
  if (!raw) return missing;

  const value = raw.trim();
  if (HEX_PATTERN.test(value)) return value;
  if (/^rgba?\(/i.test(value)) return value;

  const variable = VAR_PATTERN.exec(value);
  if (variable) return fromVariable(variable[1], t) ?? missing;

  // A bare CSS colour keyword is still something React Native can paint.
  if (/^[a-z]+$/i.test(value)) return value;

  return missing;
}
