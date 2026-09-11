import { useEffect, useState } from 'react';

/**
 * A value that settles rather than following every keystroke.
 *
 * The update happens in a timer callback, not in the effect body, so it does
 * not force the extra render pass that setting state synchronously during an
 * effect would.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
