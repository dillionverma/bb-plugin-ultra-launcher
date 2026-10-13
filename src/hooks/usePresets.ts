import { useCallback, useEffect, useState } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../server";
import { EMPTY_PRESETS, PRESETS_CHANNEL, type ModelPreset, type PresetState } from "../lib/presets";
export function usePresets() {
  const rpc = useRpc<typeof rpcContract>();
  const [state, setState] = useState<PresetState>(EMPTY_PRESETS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const next = await rpc.call("get_presets", {});
      setState((current) => (next.revision >= current.revision ? next : current));
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [rpc]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useRealtime(PRESETS_CHANNEL, () => void reload());
  async function save(presets: ModelPreset[], expectedRevision = state.revision) {
    const next = await rpc.call("save_presets", { expectedRevision, presets });
    setState((current) => (next.revision >= current.revision ? next : current));
    return next;
  }
  /** Replace the saved list with the recommended defaults for this machine. */
  async function restoreDefaults() {
    const next = await rpc.call("restore_default_presets", {});
    setState((current) => (next.revision >= current.revision ? next : current));
    return next;
  }
  return { state, loading, error, reload, save, restoreDefaults };
}
