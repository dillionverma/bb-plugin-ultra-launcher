import { originalProviderLogos } from "../lib/provider-logos";
import { useEffect } from "react";
import { presetStateSchema, presetsSchema, type PresetState } from "../lib/presets";
const key = "quick-thread:preview-presets:v2";
export const samples: PresetState = { revision: 0, presets: [
  { id: "opus", name: "Opus 5", providerId: "claude", model: "opus-5", reasoningLevel: "xhigh", serviceTier: "default" },
  { id: "sol", name: "GPT-5.6 Sol", providerId: "codex", model: "gpt-5.6-sol", reasoningLevel: "high", serviceTier: "default" },
] };
function read(): PresetState { try { return presetStateSchema.parse(JSON.parse(localStorage.getItem(key) ?? "null")); } catch { return samples; } }
const rpc = { async call(method: string, input: any) {
  const state = read();
  if (method === "get_presets") return state;
  if (method !== "save_presets") throw new Error("Preview-only operation");
  if (input.expectedRevision !== state.revision) throw new Error("Presets changed. Reload and try again.");
  const next = { revision: state.revision + 1, presets: presetsSchema.parse(input.presets) };
  localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event("preview-presets-changed")); return next;
} };
export function useRpc() { return rpc; }
export function useRealtime(_channel: string, callback: () => void) { useEffect(() => { window.addEventListener("preview-presets-changed", callback); return () => window.removeEventListener("preview-presets-changed", callback); }, [callback]); }
export function experimental_useProviders() { return { status: "ready", providers: [{ id: "claude", displayName: "Claude" }, { id: "codex", displayName: "Codex" }] }; }
export function experimental_ProviderIcon({ provider, className }: any) {
  const logo = originalProviderLogos[provider.id === "claude" ? "claude-code" : provider.id];
  return <span aria-hidden className={className} style={{ display: "inline-block", backgroundColor: provider.id.startsWith("claude") ? "#D97757" : "currentColor", maskImage: `url("${logo}")`, WebkitMaskImage: `url("${logo}")`, maskRepeat: "no-repeat", maskSize: "contain", maskPosition: "center" }} />;
}
export function experimental_ProviderModelPicker({ value, onChange, disabled }: any) {
  const model = value.model || (value.providerId === "claude" ? "opus-5" : "gpt-5.6-sol");
  useEffect(() => { if (!value.model) onChange({ ...value, model }); }, [value.model, model]);
  return <div className="demo-fields">
    <label>Model<select disabled={disabled} value={`${value.providerId}/${model}`} onChange={(event) => { const [providerId, model] = event.target.value.split("/"); onChange({ ...value, providerId, model, serviceTier: providerId === "claude" ? "default" : value.serviceTier }); }}><option value="claude/opus-5">Claude · Opus 5</option><option value="claude/sonnet">Claude · Sonnet</option><option value="codex/gpt-5.6-sol">Codex · GPT-5.6 Sol</option><option value="codex/gpt-6-astra">Codex · 6-Astra</option></select></label>
    <label>Effort<select disabled={disabled} value={value.reasoningLevel} onChange={(event) => onChange({ ...value, reasoningLevel: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="xhigh">Extra high</option></select></label>
    {value.providerId === "codex" ? <label><input type="checkbox" disabled={disabled} checked={value.serviceTier === "fast"} onChange={(event) => onChange({ ...value, serviceTier: event.target.checked ? "fast" : "default" })} /> Fast mode</label> : null}
  </div>;
}
