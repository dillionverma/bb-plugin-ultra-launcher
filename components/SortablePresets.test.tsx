import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SortablePresets } from "./SortablePresets";
import type { ModelPreset } from "../lib/presets";
const presets: ModelPreset[] = ["one", "two", "three"].map((id) => ({ id, name: id, providerId: "codex", model: "sol", reasoningLevel: "high", serviceTier: "default" }));
const row = (preset: ModelPreset, _index: number, handle: React.ReactNode) => <div>{handle}<span>{preset.name}</span></div>;
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    const id = this.closest("[data-preset-row]")?.getAttribute("data-preset-row");
    const y = Math.max(0, presets.findIndex((item) => item.id === id)) * 50;
    return { x: 0, y, left: 0, top: y, right: 300, bottom: y + 40, width: 300, height: 40, toJSON: () => ({}) };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("preset drag and drop", () => {
  it("reorders with the keyboard and keeps the revision captured when dragging began", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const view = render(<SortablePresets presets={presets} revision={4} onReorder={save} renderRow={row} />);
    const handle = screen.getByRole("button", { name: "Reorder one" }); handle.focus();
    fireEvent.keyDown(handle, { key: " ", code: "Space" });
    await waitFor(() => expect(handle.getAttribute("aria-pressed")).toBe("true"));
    view.rerender(<SortablePresets presets={presets} revision={5} onReorder={save} renderRow={row} />);
    fireEvent.keyDown(document, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(document, { key: " ", code: "Space" });
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].map((item: ModelPreset) => item.id)).toEqual(["two", "one", "three"]);
    expect(save.mock.calls[0][1]).toBe(4);
  });
  it("reorders by dragging the handle with the mouse", async () => {
    const save = vi.fn().mockResolvedValue(undefined); render(<SortablePresets presets={presets} revision={2} onReorder={save} renderRow={row} />);
    const handle = screen.getByRole("button", { name: "Reorder one" });
    fireEvent.mouseDown(handle, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(document, { buttons: 1, clientX: 10, clientY: 20 });
    await waitFor(() => expect(handle.getAttribute("aria-pressed")).toBe("true"));
    fireEvent.mouseMove(document, { buttons: 1, clientX: 10, clientY: 65 });
    fireEvent.mouseUp(document, { button: 0, clientX: 10, clientY: 65 });
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].map((item: ModelPreset) => item.id)).toEqual(["two", "one", "three"]);
  });
  it("cancels a drag without persisting a new order", async () => {
    const save = vi.fn(); render(<SortablePresets presets={presets} revision={0} onReorder={save} renderRow={row} />);
    const handle = screen.getByRole("button", { name: "Reorder one" }); handle.focus(); fireEvent.keyDown(handle, { key: " ", code: "Space" });
    await waitFor(() => expect(handle.getAttribute("aria-pressed")).toBe("true"));
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(handle.getAttribute("aria-pressed")).not.toBe("true"));
    expect(save).not.toHaveBeenCalled();
  });
});
