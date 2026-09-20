import { useEffect, useState } from 'react';

/** Keeps a text box responsive while the expensive work waits for a pause in
 *  typing. The input stays controlled by its own immediate state; only the
 *  value handed to the filter pipeline is delayed. */
export function useDebounced<T>(value: T, ms = 200): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}
