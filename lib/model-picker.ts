import type { ExperimentalProviderModelPickerValue } from "@get-bb/plugin-sdk";
type ReasoningLevel = ExperimentalProviderModelPickerValue["reasoningLevel"];
type ServiceTier = NonNullable<ExperimentalProviderModelPickerValue["serviceTier"]>;

/**
 * What the preset picker itself needs: the current selection plus a way to
 * apply a whole preset. Stock BB has no model-picker slot, so the Ultra Launcher
 * dialog supplies these directly and seeds the host composer with the result;
 * a patched BB passes the same fields as part of {@link ModelPickerProps}.
 */
export interface PresetSelectionProps {
  providerId: string;
  model: string;
  reasoningLevel: ReasoningLevel;
  serviceTier?: ServiceTier;
  supportsServiceTier?: boolean;
  disabled?: boolean;
  onPresetSelect(selection: ExperimentalProviderModelPickerValue): Promise<void>;
}

// Matches the experimental BB core contract bundled in core-patches/.
// Keep this structural type until the API ships in the published SDK.
export interface ModelPickerProps extends PresetSelectionProps {
  providers: readonly { value: string; label: string; disabled?: boolean }[];
  models: readonly { value: string; label: string; description?: string; disabled?: boolean }[];
  reasoningOptions: readonly { value: ReasoningLevel; label: string; disabled?: boolean }[];
  isLoading: boolean;
  error: string | null;
  canSelectModel: boolean;
  canChangeProvider: boolean;
  onProviderChange(providerId: string): void;
  onModelChange(model: string): void;
  onReasoningChange(level: ReasoningLevel): void;
  onServiceTierChange(tier: ServiceTier): void;
}
