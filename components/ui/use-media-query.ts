import { useCallback, useSyncExternalStore } from "react";

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsCompactViewport(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

export function usePointerCoarse(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
