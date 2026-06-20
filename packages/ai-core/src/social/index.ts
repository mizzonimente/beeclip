import type { SocialProfileProvider, SocialProfileAnalysisInput } from "./types.js";
import { InstagramGraphOwnAccountProvider } from "./instagramOwnAccountProvider.js";
import { LicensedReferenceProvider } from "./licensedReferenceProvider.js";
import { MockSocialProfileProvider } from "./mockProvider.js";

export * from "./types.js";
export { InstagramGraphOwnAccountProvider, computeInsightsFromMedia } from "./instagramOwnAccountProvider.js";
export { LicensedReferenceProvider } from "./licensedReferenceProvider.js";
export { MockSocialProfileProvider } from "./mockProvider.js";

/** Catena di provider: prova quelli reali in ordine, ricade sul mock se
 *  nessuno è applicabile/configurato. */
export function createSocialProfileResolver(env: {
  SOCIAL_DATA_PROVIDER?: string;
  SOCIAL_DATA_PROVIDER_API_KEY?: string;
}) {
  const providers: SocialProfileProvider[] = [
    new InstagramGraphOwnAccountProvider(),
    ...(env.SOCIAL_DATA_PROVIDER === "licensed_provider"
      ? [new LicensedReferenceProvider(env.SOCIAL_DATA_PROVIDER_API_KEY, undefined)]
      : []),
    new MockSocialProfileProvider(),
  ];

  return {
    async analyze(input: SocialProfileAnalysisInput) {
      const provider = providers.find((p) => p.supports(input))!;
      return { insights: await provider.analyzeProfile(input), sourceProvider: provider.name };
    },
  };
}
