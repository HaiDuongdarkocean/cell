/**
 * Compile-time feature flags.
 *
 * Toggle these during the React shadow-root migration to keep the legacy
 * code path alive and runnable until the new path is fully verified.
 */

/** When true, the popup dictionary uses the legacy `PopupShell` path.
 *  When false, it uses the new React `PopupDictionary` path. */
export const USE_LEGACY_POPUP_DICTIONARY = false;
