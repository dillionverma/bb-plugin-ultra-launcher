import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PresetSettings } from "./PresetSettings";
import type { PresetState } from "../lib/presets";
const mocks = vi.hoisted(() => ({
  state: { revision: 0, presets: [] } as PresetState,
  save: vi.fn(),
  restoreDefaults: vi.fn(),
}));
vi.mock("../hooks/usePresets", () => ({
  usePresets: () => ({
    state: mocks.state,
    save: mocks.save,
    restoreDefaults: mocks.restoreDefaults,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock("@get-bb/plugin-sdk/app", () => ({
  experimental_useProviders: () => ({ providers: [{ id: "codex" }] }),
  experimental_ProviderIcon: () => null,
  experimental_ProviderModelPicker: ({ value, onChange }: any) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          ...value,
          providerId: "codex",
          model: "sol",
          reasoningLevel: "high",
          serviceTier: "fast",
        })
      }
    >
      Choose Sol High Fast
    </button>
  ),
}));
afterEach(cleanup);
beforeEach(() => {
  mocks.state = { revision: 0, presets: [] };
  mocks.save.mockReset().mockResolvedValue({ revision: 1, presets: [] });
  mocks.restoreDefaults.mockReset().mockResolvedValue({ revision: 1, presets: [] });
});
describe("preset settings editor", () => {
  it("saves a named complete model combination through the shared store", async () => {
    render(<PresetSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Add preset" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Preset name" }), {
      target: { value: "Daily coding" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Choose Sol High Fast" }));
    fireEvent.click(screen.getByRole("button", { name: "Save preset" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(mocks.save.mock.calls[0]).toEqual([
      [
        expect.objectContaining({
          name: "Daily coding",
          providerId: "codex",
          model: "sol",
          reasoningLevel: "high",
          serviceTier: "fast",
        }),
      ],
      0,
    ]);
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  });
  it("cancels unsaved edits and preserves the draft on a conflicting remote change", () => {
    const view = render(<PresetSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Add preset" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "My draft" } });
    mocks.state = { revision: 1, presets: [] };
    view.rerender(<PresetSettings />);
    expect(screen.getByRole("alert").textContent).toContain("changed in another window");
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("My draft");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("restores the recommended defaults only after an explicit confirmation", async () => {
    mocks.state = {
      revision: 2,
      presets: [
        { id: "a", name: "Mine", providerId: "codex", model: "sol", reasoningLevel: "high", serviceTier: "default" },
      ],
    };
    render(<PresetSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(mocks.restoreDefaults).not.toHaveBeenCalled();
    expect(screen.getByText("Replace your 1 preset?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Replace your 1 preset?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(mocks.restoreDefaults).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByText("Replace your 1 preset?")).toBeNull());
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("saves model changes directly without opening an editor", async () => {
    mocks.state = { revision: 4, presets: [
      { id: "a", name: "My preset", providerId: "codex", model: "astra", reasoningLevel: "medium", serviceTier: "default" },
    ] };
    render(<PresetSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Sol High Fast" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: "a", name: "My preset", model: "sol", reasoningLevel: "high", serviceTier: "fast" }),
    ], 4));
    expect(screen.queryByRole("textbox")).toBeNull();
    await screen.findByText("Changes saved");
  });
  it("starts from an existing configuration and generates a name when omitted", async () => {
    mocks.state = { revision: 2, presets: [
      { id: "a", name: "Original", providerId: "codex", model: "astra", reasoningLevel: "max", serviceTier: "default" },
    ] };
    render(<PresetSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Add preset" }));
    fireEvent.click(screen.getByRole("button", { name: /Save preset/ }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    const [presets, revision] = mocks.save.mock.calls[0];
    expect(revision).toBe(2);
    expect(presets).toHaveLength(2);
    expect(presets[1]).toMatchObject({ name: "astra · Max", model: "astra", reasoningLevel: "max" });
    expect(presets[1].id).not.toBe("a");
  });
  it("keeps a failed save visible and retains the draft for retry", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Connection lost"));
    render(<PresetSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Add preset" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose Sol High Fast" }));
    fireEvent.click(screen.getByRole("button", { name: /Save preset/ }));
    await screen.findByText("Connection lost");
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.queryByText("Changes saved")).toBeNull();
  });

});
