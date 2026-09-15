import { experimental_ProviderIcon as ProviderIcon, experimental_useProviders as useProviders } from "@get-bb/plugin-sdk/app";
import { originalProviderLogos } from "../lib/provider-logos";
export function OriginalProviderLogo({ providerId, className = "size-4 shrink-0" }: { providerId: string; className?: string }) {
  const logo = originalProviderLogos[providerId === "claude" ? "claude-code" : providerId];
  return logo ? <span aria-hidden="true" className={className} style={{ display: "inline-block", backgroundColor: providerId.startsWith("claude") ? "#D97757" : "currentColor", maskImage: `url("${logo}")`, WebkitMaskImage: `url("${logo}")`, maskRepeat: "no-repeat", maskSize: "contain", maskPosition: "center" }} /> : null;
}
export function PresetProviderLogo({ providerId }: { providerId: string }) {
  const { providers } = useProviders();
  const provider = providers.find((item) => item.id === providerId);
  if (provider) return <ProviderIcon providerKind="agent" provider={provider} className="size-4 shrink-0" />;
  return <OriginalProviderLogo providerId={providerId} />;
}
