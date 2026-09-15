import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuickModelPicker, type PresetPickerProps } from "./QuickModelPicker";
import type { ModelPreset } from "../lib/presets";
import type { ModelPickerProps } from "../lib/model-picker";
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
function props(): PresetPickerProps & ModelPickerProps {
  return {
    presets,
    revision: 0,
    onReorder: vi.fn().mockResolvedValue(undefined),
    onSave: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onPresetSelect: vi.fn().mockResolvedValue(undefined),
    providerId: "claude",
    providers: [],
    model: "opus",
    models: [{ value: "hidden", label: "Do not show this model" }],
    reasoningLevel: "xhigh",
    reasoningOptions: [],
    supportsServiceTier: false,
    isLoading: false,
    error: null,
    disabled: false,
    canSelectModel: true,
    canChangeProvider: true,
    onModelChange: vi.fn(),
    onProviderChange: vi.fn(),
    onReasoningChange: vi.fn(),
    onServiceTierChange: vi.fn(),
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
        <QuickModelPicker {...value} />
      </form>,
    );
    open();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
    expect(screen.queryByText("Do not show this model")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /GPT-5.6 Sol/ }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(value.onPresetSelect).toHaveBeenCalledExactlyOnceWith({
      providerId: "codex",
      model: "sol",
      reasoningLevel: "high",
      serviceTier: "fast",
    });
    expect(value.onProviderChange).not.toHaveBeenCalled();
    expect(value.onModelChange).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
  it("preserves the current selection and shows an error when a preset is unavailable", async () => {
    const value = props();
    value.onPresetSelect = vi.fn().mockRejectedValue(new Error("Model unavailable"));
    render(<QuickModelPicker {...value} />);
    open();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /GPT-5.6 Sol/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Model unavailable");
    expect(screen.getByRole("menuitemradio", { name: /Opus 5/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });
  it("opens settings from the empty state without showing the catalog", () => {
    const value = props();
    render(<QuickModelPicker {...value} presets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose preset" }));
    expect(screen.queryByRole("menuitemradio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Edit presets/ }));
    expect(value.onEdit).toHaveBeenCalledOnce();
  });
  it("supports arrow-key navigation in saved order", () => {
    render(<QuickModelPicker {...props()} />);
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
    render(<form onSubmit={submit}><QuickModelPicker {...value} /></form>);
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
    render(<QuickModelPicker {...value} presets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose preset" }));
    fireEvent.click(screen.getByRole("button", { name: /Add new preset/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pick Astra" }));
    fireEvent.click(screen.getByRole("button", { name: "Add preset" }));
    await waitFor(() => expect(value.onSave).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ name: "astra · Ultra", providerId: "codex", model: "astra", reasoningLevel: "ultra", serviceTier: "fast" })], 0));
    expect(value.onPresetSelect).not.toHaveBeenCalled();
  });

  it("deletes only the requested preset without selecting it", async () => {
    const value = props();
    render(<QuickModelPicker {...value} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Delete Opus 5" }));
    await waitFor(() => expect(value.onSave).toHaveBeenCalledExactlyOnceWith([presets[1]], 0));
    expect(value.onPresetSelect).not.toHaveBeenCalled();
  });

  it("preserves the draft on save failure and prevents concurrent writes", async () => {
    const value = props();
    let reject!: (error: Error) => void;
    value.onSave = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    render(<QuickModelPicker {...value} />);
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
    const view = render(<QuickModelPicker {...value} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Rename Opus 5" }));
    view.rerender(<QuickModelPicker {...value} revision={1} />);
    expect(screen.getByRole("alert").textContent).toContain("Presets changed");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Preset name" }), { key: "Enter" });
    expect(value.onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Preset name" }), { key: "Escape" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});
