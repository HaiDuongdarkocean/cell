// contrastValidator — WCAG 2.1 contrast validation (ADR-022 D2, spec F3).
//
// Pure logic, no DOM deps. validateTheme kiểm tra 3 pair quan trọng:
// text/canvas, text-secondary/canvas, white/primary (button text trên primary bg).

import { getLuminance } from '@/features/theme/logic/colorGenerator';
import tokensJson from '@/shared/styles/tokens.json';
import type { CoreColorTokens } from '@/entities/theme';

/** WCAG contrast ratio giữa 2 hex color (1-21). */
export function getContrastRatio(fg: string, bg: string): number {
  const l1 = getLuminance(fg);
  const l2 = getLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA normal text: ≥ 4.5:1. */
export function meetsAA(ratio: number): boolean {
  return ratio >= 4.5;
}

/** WCAG AAA normal text: ≥ 7:1. */
export function meetsAAA(ratio: number): boolean {
  return ratio >= 7;
}

/** WCAG AA large text (≥18pt or ≥14pt bold): ≥ 3:1. */
export function meetsAALarge(ratio: number): boolean {
  return ratio >= 3;
}

export interface ContrastRating {
  readonly level: 'AA' | 'AAA' | 'Fail';
  readonly ratio: number;
  readonly pass: boolean;
}

/** Rating cho 1 contrast ratio — AAA > AA > Fail. */
export function getRating(ratio: number): ContrastRating {
  if (meetsAAA(ratio)) return { level: 'AAA', ratio, pass: true };
  if (meetsAA(ratio)) return { level: 'AA', ratio, pass: true };
  return { level: 'Fail', ratio, pass: false };
}

export interface PairResult {
  readonly label: string;
  readonly fg: string;
  readonly bg: string;
  readonly ratio: number;
  readonly rating: ContrastRating;
}

export interface ValidationResult {
  readonly pairs: readonly PairResult[];
  readonly allPass: boolean;
}

/**
 * Validate 3 critical contrast pairs cho 1 mode palette:
 * 1. text/canvas — body text readability
 * 2. textSecondary/canvas — secondary text readability
 * 3. white/primary — button label trên primary bg
 */
export function validateTheme(colors: CoreColorTokens): ValidationResult {
  const pairs: PairResult[] = [
    makePair('Text / Canvas', colors.text, colors.background),
    makePair('Text Secondary / Canvas', colors.textSecondary, colors.background),
    makePair('White / Primary', tokensJson.core.light.background, colors.primary),
  ];
  return { pairs, allPass: pairs.every((p) => p.rating.pass) };
}

function makePair(label: string, fg: string, bg: string): PairResult {
  const ratio = getContrastRatio(fg, bg);
  return { label, fg, bg, ratio, rating: getRating(ratio) };
}
