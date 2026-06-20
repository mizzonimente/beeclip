import type { SocialProfileInsights } from "@clipmanager/shared";

export type SocialPlatformKey = "TIKTOK" | "INSTAGRAM" | "YOUTUBE_SHORTS" | "LINKEDIN" | "FACEBOOK" | "OTHER";
export type ProfileConnectionKey = "OAUTH" | "MANUAL" | "LICENSED_PROVIDER";

export interface SocialProfileAnalysisInput {
  platform: SocialPlatformKey;
  handle: string;
  connectedVia: ProfileConnectionKey;
  /** Token OAuth dell'account collegato dal cliente (mai usato per account di terzi). */
  accessToken?: string;
}

export interface SocialProfileProvider {
  readonly name: string;
  /** true se questo provider sa gestire la combinazione piattaforma/tipo di connessione richiesta. */
  supports(input: SocialProfileAnalysisInput): boolean;
  analyzeProfile(input: SocialProfileAnalysisInput): Promise<SocialProfileInsights>;
}
