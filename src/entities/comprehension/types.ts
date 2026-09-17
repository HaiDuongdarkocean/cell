export type ComprehensionKind = 'media' | 'text';
export type ComprehensionBand = 'comfortable' | 'stretch' | 'hard';

export interface ComprehensionStats {
  readonly kind: ComprehensionKind;
  /** Non-separator (running) tokens counted. */
  readonly totalTokens: number;
  /** Tokens with status 'known' or 'ignore'. */
  readonly knownTokens: number;
  readonly trackingTokens: number;
  readonly unknownTokens: number;
  /** 0–100, one decimal: (known + 0.5·tracking) / total · 100. */
  readonly coverage: number;
  readonly band: ComprehensionBand;
  /** Unique terms with status unknown|tracking. */
  readonly newTerms: number;
}
