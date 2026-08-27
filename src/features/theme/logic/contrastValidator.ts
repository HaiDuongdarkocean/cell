// contrastValidator — WCAG 2.1 contrast validation (ADR-022 D2, spec F3).
//
// Thin runtime facade over src/shared/lib/contrast.ts. Pure logic, no DOM deps.
// validateTheme kiểm tra 3 pair quan trọng:
// text/canvas, text-secondary/canvas, primary-foreground/primary.

import {
  getContrastRatio as getContrastRatioEngine,
  meetsAA as meetsAAEngine,
  meetsAAA as meetsAAAEngine,
  getRating as getRatingEngine,
  pickPrimaryForeground as pickPrimaryForegroundEngine,
} from '@/shared/lib/contrast';
import type { ContrastRating } from '@/shared/lib/contrast';
import type { CoreColorTokens } from '@/entities/theme';

export type { ContrastRating };

/** WCAG contrast ratio between two opaque colors (1-21). */
export function getContrastRatio(fg: string, bg: string): number {
  return getContrastRatioEngine(fg, bg);
}

/** WCAG AA: ≥ 4.5 for normal text, ≥ 3.0 for large text. */
export function meetsAA(ratio: number, isLargeText = false): boolean {
  return meetsAAEngine(ratio, isLargeText);
}

/** WCAG AAA: ≥ 7 for normal text, ≥ 4.5 for large text. */
export function meetsAAA(ratio: number, isLargeText = false): boolean {
  return meetsAAAEngine(ratio, isLargeText);
}

/** WCAG AA large text (≥18pt or ≥14pt bold): ≥ 3:1. */
export function meetsAALarge(ratio: number): boolean {
  return meetsAAEngine(ratio, true);
}

/** Rating for a contrast ratio — AAA > AA > Fail. */
export function getRating(ratio: number, isLargeText = false): ContrastRating {
  return getRatingEngine(ratio, isLargeText);
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
 * Choose a readable foreground for the primary surface.
 * Candidates are ordered by design intent: canvas, body text, then extremes.
 */
export function pickPrimaryForeground(colors: CoreColorTokens): string {
  const candidates = [colors.background, colors.text, '#000000', '#FFFFFF'];
  return pickPrimaryForegroundEngine(colors.primary, candidates);
}

/**
 * Validate 3 critical contrast pairs for one mode palette.
 * All three use the normal-text AA threshold (4.5:1) unless the caller
 * explicitly tags a pair as large text.
 */
export function validateTheme(colors: CoreColorTokens): ValidationResult {
  const primaryForeground = pickPrimaryForeground(colors);
  const pairs: PairResult[] = [
    makePair('Text / Canvas', colors.text, colors.background),
    makePair('Text Secondary / Canvas', colors.textSecondary, colors.background),
    makePair('Primary Foreground / Primary', primaryForeground, colors.primary),
  ];
  return { pairs, allPass: pairs.every((p) => p.rating.pass) };
}

function makePair(label: string, fg: string, bg: string): PairResult {
  const ratio = getContrastRatio(fg, bg);
  return { label, fg, bg, ratio, rating: getRating(ratio) };
}
