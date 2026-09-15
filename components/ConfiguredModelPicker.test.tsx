import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfiguredModelPicker } from "./ConfiguredModelPicker";
import type { PresetState } from "../lib/presets";

const mocks = vi.hoisted(() => ({
  state: {
    revision: 3,
    presets: [
      { id: "a", name: "Daily coding", providerId: "codex", model: "gpt-6-astra", reasoningLevel: "high", serviceTier: "default" },
      { id: "b", name: "Deep think", providerId: "codex", model: "gpt-5.6-sol", reasoningLevel: "max", serviceTier: "default" },
    ],
  } as PresetState,
}));
vi.mock("../hooks/usePresets", () => ({
  usePresets: () => ({ state: mocks.state, save: vi.fn(), loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("@get-bb/plugin-sdk/app", () => ({
  experimental_useProviders: () => ({ providers: [{ id: "codex" }] }),
  experimental_ProviderIcon: () => null,
}));

afterEach(cleanup);

// On stock BB the dialog renders this picker itself, passing only the current
// selection — there is no host model-picker slot to hand it catalog props.
describe("ConfiguredModelPicker on an unpatched host", () => {
  it("renders the saved presets from the selection alone", async () => {
    const onPresetSelect = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfiguredModelPicker
        providerId="codex"
        model="gpt-6-astra"
        reasoningLevel="high"
        serviceTier="default"
        onPresetSelect={onPresetSelect}
      />,
    );

    expect(screen.getByRole("button", { name: "Choose preset: Daily coding" }).textContent).toContain("gpt-6-astra · High");
    fireEvent.click(screen.getByRole("button", { name: "Choose preset: Daily coding" }));
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
    expect(
      screen.getByRole("menuitemradio", { name: /Daily coding/ }).getAttribute("aria-checked"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("menuitemradio", { name: /Deep think/ }));
    await waitFor(() =>
      expect(onPresetSelect).toHaveBeenCalledExactlyOnceWith({
        providerId: "codex",
        model: "gpt-5.6-sol",
        reasoningLevel: "max",
        serviceTier: "default",
      }),
    );
  });
});
