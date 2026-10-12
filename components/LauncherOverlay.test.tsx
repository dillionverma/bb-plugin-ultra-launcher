import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { mockViewport } from "../test/viewport";

afterEach(() => {
  cleanup();
  mockViewport({ phone: false });
});

describe.each([
  { viewport: "desktop", phone: false, sheet: false },
  { viewport: "phone", phone: true, sheet: true },
])("launcher on $viewport", ({ phone, sheet }) => {
  it("opens as a modal with Cmd+N, closes on Escape, and keeps the composer mounted", async () => {
    mockViewport({ phone });
    const app = await loadPluginApp(() => import("../app"));
    const launcher = app.appOverlays.find((overlay) => overlay.id === "ultra-launcher")!;
    renderSlot(launcher, {}, {
      rpc: {
        get_presets: () => ({ revision: 0, presets: [] }),
        get_selected_preset: () => ({ presetId: null }),
      },
    });

    fireEvent.keyDown(document, { key: "n", code: "KeyN", metaKey: true });
    const dialog = await screen.findByRole("dialog", { name: "New thread" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(screen.getByTestId("bb-new-thread-composer"))).toBe(true);
    expect(dialog.querySelector("[data-persistent-drawer-handle]") !== null).toBe(sheet);

    fireEvent.keyDown(document, { key: "Escape" });
    // A closed launcher must not look like an open modal, or BB suppresses its own shortcuts.
    await waitFor(() => expect(document.querySelector('[aria-modal="true"]')).toBeNull());
    expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
    expect(screen.getByTestId("bb-new-thread-composer")).toBeTruthy();
  });
});
