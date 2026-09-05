// Breakpoint SSOT for the JS side.
//
// CSS `@media` cannot consume `var(--*)`, so the px values in module CSS
// (`599px`, `639px`, `839px`, `360px`, `520px`) stay literal. Any
// `matchMedia`/JS resize check MUST use these constants so both sides
// stay in sync. When changing a value, grep the module CSS for the old
// number and update the `@media` rule to match.
export const BREAKPOINTS = {
  /** Small screens — horizontal chip-bar nav, bottom-sheet behavior. */
  mobileMax: 599,
} as const;

/** Ready-made media query strings for `matchMedia`. */
export const MEDIA_QUERIES = {
  mobileMax: `(max-width: ${BREAKPOINTS.mobileMax}px)`,
} as const;
