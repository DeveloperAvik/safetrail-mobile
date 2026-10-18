import { useEffect, useState } from 'react';

/** Seconds remaining until `deadline` (ISO), updated every second. */
export function useCountdown(deadline: string | null | undefined): number | null {
  const compute = () => (deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 1000)) : null);
  const [left, setLeft] = useState(compute);
  useEffect(() => {
    setLeft(compute());
    if (!deadline) return;
    const t = setInterval(() => setLeft(compute()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);
  return left;
}
