/**
 * Card Creator icon SVGs (lightning bolt for quick update, pencil for edit).
 *
 * Source: docs/mockups/icon-svg/anki-quick.svg + anki-edit.svg.
 * Style matches the icon-svg collection (stroke 1.5, currentColor, round caps).
 */

/** Lightning bolt — quick update nearest card. */
export const CARD_CREATOR_ICONS = {
  quick: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M12 20h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
} as const;
