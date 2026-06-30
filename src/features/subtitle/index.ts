/**
 * Subtitle feature — overlay/sync/merge/bilingual (logic + ui + service).
 *
 * Layers:
 * - logic/   — parsing, merge, sync, naming, import, auto-load, bilingual,
 *              drag-drop (pure functions + content-script helpers)
 * - ui/      — overlay, panel, manager, selector, shortcuts, toast,
 *              track-dropdown, drag-position, UI helpers (DOM injection)
 * - service/ — background-side subtitle fetching/selection for overlay
 */
export * from './logic';
export * from './ui';
export * from './service';
