import { useCallback, useEffect, useState } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../server";
import { SELECTION_CHANNEL } from "../lib/selection-store";

/** The preset id the dialog last seeded, shared across windows. */
export function useSelectedPreset() {
  const rpc = useRpc<typeof rpcContract>();
  const [presetId, setPresetId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const next = await rpc.call("get_selected_preset", {});
      setPresetId(next.presetId);
    } finally {
      setLoaded(true);
    }
  }, [rpc]);

  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);
  useRealtime(SELECTION_CHANNEL, () => void reload().catch(() => {}));

  const select = useCallback(
    async (id: string | null) => {
      setPresetId(id); // optimistic: the picker closes on the same click
      await rpc.call("set_selected_preset", { presetId: id });
    },
    [rpc],
  );

  return { presetId, loaded, select };
}
