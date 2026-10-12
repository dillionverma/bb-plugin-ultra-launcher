import { vi } from "vitest";

export function mockViewport({ phone }: { phone: boolean }) {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: phone && (query === "(max-width: 767px)" || query === "(pointer: coarse)"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}
