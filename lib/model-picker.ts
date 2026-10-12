import type { ExperimentalProviderModelPickerValue } from "@get-bb/plugin-sdk";
type ReasoningLevel = ExperimentalProviderModelPickerValue["reasoningLevel"];
type ServiceTier = NonNullable<ExperimentalProviderModelPickerValue["serviceTier"]>;

export interface PresetSelectionProps {
  providerId: string;
  model: string;
  reasoningLevel: ReasoningLevel;
  serviceTier?: ServiceTier;
  supportsServiceTier?: boolean;
  disabled?: boolean;
  onPresetSelect(selection: ExperimentalProviderModelPickerValue): Promise<void>;
}
