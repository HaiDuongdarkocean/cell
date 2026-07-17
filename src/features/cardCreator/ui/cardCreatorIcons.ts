/**
 * Card Creator icon SVGs (lightning bolt for quick update, pencil for edit).
 *
 * Source: Lucide (lucide-static) — stroke 2.0, currentColor, round caps.
 * Synced with src/shared/icons/svg/ for consistency across popup + cluster.
 */
import { ICON_CATALOG } from '@/shared/icons';

/** Lightning bolt — quick update nearest card. Pencil — edit/send to card. */
export const CARD_CREATOR_ICONS = {
  quick: ICON_CATALOG.zap.svg,
  edit: ICON_CATALOG.pencil.svg,
} as const;
