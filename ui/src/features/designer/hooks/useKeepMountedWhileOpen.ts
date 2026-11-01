import { useEffect, useState } from "react";

/**
 * Returns true while `open` is true and for `exitMs` after it turns false, so a closed modal can
 * be unmounted (dropping its store subscriptions/work) without cutting its exit transition.
 */
export function useKeepMountedWhileOpen(open: boolean, exitMs = 600): boolean {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);

  return open || mounted;
}
