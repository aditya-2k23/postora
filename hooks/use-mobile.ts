import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const subscribe = React.useCallback((callback: () => void) => {
    if (typeof window === "undefined") {
      return () => {};
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => callback();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const getSnapshot = React.useCallback(
    () =>
      typeof window !== "undefined"
        ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
        : false,
    [],
  );

  const getServerSnapshot = React.useCallback(() => false, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
