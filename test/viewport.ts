import { vi } from "vitest";

/** Phone viewports match both the width breakpoint and a coarse pointer. */
export function mockViewport({ compact }: { compact: boolean }) {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: compact && (query === "(max-width: 767px)" || query === "(pointer: coarse)"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}
