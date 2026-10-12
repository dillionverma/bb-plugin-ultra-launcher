import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PresetPicker, type PresetPickerProps } from "./PresetPicker";
import type { ModelPreset } from "../lib/presets";
import { mockViewport } from "../test/viewport";
const presets: ModelPreset[] = [
  {
    id: "opus",
    name: "Opus 5",
    providerId: "claude",
    model: "opus",
    reasoningLevel: "xhigh",
    serviceTier: "default",
  },
  {
    id: "sol",
    name: "GPT-5.6 Sol",
    providerId: "codex",
    model: "sol",
    reasoningLevel: "high",
    serviceTier: "fast",
  },
];
function props(): PresetPickerProps {
  return {
    presets,
    revision: 0,
    onReorder: vi.fn().mockResolvedValue(undefined),
    onSave: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onPresetSelect: vi.fn().mockResolvedValue(undefined),
    providerId: "claude",
    model: "opus",
    reasoningLevel: "xhigh",
    disabled: false,
  };
}
function open() {
  fireEvent.click(screen.getByRole("button", { name: "Choose preset: Opus 5" }));
}
afterEach(cleanup);
describe("preset-only picker", () => {
  it("shows only configured presets and applies the whole combination with one action", async () => {
    const value = props();
    const submit = vi.fn();
    render(
      <form onSubmit={submit}>
        <PresetPicker {...value} />
      </form>,
    );
    open();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /GPT-5.6 Sol/ }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(value.onPresetSelect).toHaveBeenCalledExactlyOnceWith({
      providerId: "codex",
      model: "sol",
      reasoningLevel: "high",
      serviceTier: "fast",
    });
    expect(submit).not.toHaveBeenCalled();
  });
  it("preserves the current selection and shows an error when a preset is unavailable", async () => {
    const value = props();
    value.onPresetSelect = vi.fn().mockRejectedValue(new Error("Model unavailable"));
    render(<PresetPicker {...value} />);
    open();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /GPT-5.6 Sol/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Model unavailable");
    expect(screen.getByRole("menuitemradio", { name: /Opus 5/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });
  it("opens settings from the empty state without showing the catalog", () => {
    const value = props();
    render(<PresetPicker {...value} presets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose preset" }));
    expect(screen.queryByRole("menuitemradio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Edit presets/ }));
    expect(value.onEdit).toHaveBeenCalledOnce();
  });
  it("shows what a preset resolves to only when its name is not already that", () => {
    const value = props();
    render(
      <PresetPicker
        {...value}
        presets={[
          { ...presets[0]!, name: "astra med", model: "gpt-6-astra", reasoningLevel: "medium" },
          { ...presets[1]!, name: "sol · High", model: "sol", reasoningLevel: "high" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose preset" }));
    // Renamed: the row carries the name plus the combination it applies.
    expect(screen.getByRole("menuitemradio", { name: "astra med gpt-6-astra · Medium" })).toBeTruthy();
    // Auto-named: the name already is the combination, so it is not repeated.
    expect(screen.getByRole("menuitemradio", { name: "sol · High" })).toBeTruthy();
  });
  it("supports arrow-key navigation in saved order", () => {
    render(<PresetPicker {...props()} />);
    open();
    const items = screen.getAllByRole("menuitemradio");
    items[0].focus();
    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });
});


describe("inline preset management", () => {
  it("renames inline without changing the model or submitting the outer form", async () => {
    const value = props();
    const submit = vi.fn();
    render(<form onSubmit={submit}><PresetPicker {...value} /></form>);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Rename Opus 5" }));
    const input = screen.getByRole("textbox", { name: "Preset name" });
    fireEvent.change(input, { target: { value: "Daily coding" } });
    fireEvent.keyDown(input, { key: "Home" });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(value.onSave).toHaveBeenCalledExactlyOnceWith([{ ...presets[0], name: "Daily coding" }, presets[1]], 0));
    expect(submit).not.toHaveBeenCalled();
    expect(value.onPresetSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("adds a model combination inline with a suggested name", async () => {
    const value = props();
    value.renderModelPicker = (_draft, onChange) => <button type="button" onClick={() => onChange({ providerId: "codex", model: "astra", reasoningLevel: "ultra", serviceTier: "fast" })}>Pick Astra</button>;
    render(<PresetPicker {...value} presets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose preset" }));
    fireEvent.click(screen.getByRole("button", { name: /Add new preset/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pick Astra" }));
    fireEvent.click(screen.getByRole("button", { name: "Add preset" }));
    await waitFor(() => expect(value.onSave).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ name: "astra · Ultra", providerId: "codex", model: "astra", reasoningLevel: "ultra", serviceTier: "fast" })], 0));
    expect(value.onPresetSelect).not.toHaveBeenCalled();
  });

  it("deletes only the requested preset without selecting it", async () => {
    const value = props();
    render(<PresetPicker {...value} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Delete Opus 5" }));
    await waitFor(() => expect(value.onSave).toHaveBeenCalledExactlyOnceWith([presets[1]], 0));
    expect(value.onPresetSelect).not.toHaveBeenCalled();
  });

  it("preserves the draft on save failure and prevents concurrent writes", async () => {
    const value = props();
    let reject!: (error: Error) => void;
    value.onSave = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    render(<PresetPicker {...value} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Rename Opus 5" }));
    const input = screen.getByRole("textbox", { name: "Preset name" });
    fireEvent.change(input, { target: { value: "Keep this name" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(value.onSave).toHaveBeenCalledOnce();
    reject(new Error("Connection lost"));
    expect((await screen.findByRole("alert")).textContent).toBe("Connection lost");
    expect((screen.getByRole("textbox", { name: "Preset name" }) as HTMLInputElement).value).toBe("Keep this name");
  });

  it("blocks a stale draft and cancels it without closing the picker", () => {
    const value = props();
    const view = render(<PresetPicker {...value} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Rename Opus 5" }));
    view.rerender(<PresetPicker {...value} revision={1} />);
    expect(screen.getByRole("alert").textContent).toContain("Presets changed");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Preset name" }), { key: "Enter" });
    expect(value.onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Preset name" }), { key: "Escape" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});

describe("preset picker on a phone", () => {
  afterEach(() => mockViewport({ phone: false }));

  function openSheet() {
    mockViewport({ phone: true });
    const value = props();
    render(<PresetPicker {...value} />);
    const trigger = screen.getByRole("button", { name: "Choose preset: Opus 5" });
    trigger.focus();
    fireEvent.click(trigger);
    return { value, trigger };
  }

  it("opens as a bottom sheet, applies a preset, and returns focus to the trigger", async () => {
    const { value, trigger } = openSheet();
    const sheet = await screen.findByRole("dialog");
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(sheet.querySelector("[data-persistent-drawer-handle]")).not.toBeNull();
    fireEvent.click(await within(sheet).findByRole("menuitemradio", { name: /GPT-5.6 Sol/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(value.onPresetSelect).toHaveBeenCalledExactlyOnceWith({
      providerId: "codex",
      model: "sol",
      reasoningLevel: "high",
      serviceTier: "fast",
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape and on a backdrop tap without applying a preset", async () => {
    const { value, trigger } = openSheet();
    await screen.findByRole("menuitemradio", { name: /GPT-5.6 Sol/ });
    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    await screen.findByRole("dialog");
    fireEvent.click(document.querySelector("[data-persistent-drawer-backdrop]")!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(value.onPresetSelect).not.toHaveBeenCalled();
  });
});
