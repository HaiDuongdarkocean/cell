// contrastValidator — WCAG 2.1 primary-foreground picker (ADR-022 D2).
//
// Thin runtime facade over src/shared/lib/contrast.ts. Pure logic, no DOM deps.

import { pickPrimaryForeground as pickPrimaryForegroundEngine } from '@/shared/lib/contrast';
import type { CoreColorTokens } from '@/entities/theme';

/**
 * Choose a readable foreground for the primary surface.
 * Candidates are ordered by design intent: canvas, body text, then extremes.
 */
export function pickPrimaryForeground(colors: CoreColorTokens): string {
  const candidates = [colors.background, colors.text, '#000000', '#FFFFFF'];
  return pickPrimaryForegroundEngine(colors.primary, candidates);
}
