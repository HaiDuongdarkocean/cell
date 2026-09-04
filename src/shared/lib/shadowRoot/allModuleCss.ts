/**
 * All CSS modules in src/, inlined as strings at build time via
 * `import.meta.glob`. Single source of truth for Shadow DOM style injection —
 * new components with a `.module.css` are picked up automatically, no manual
 * `?inline` import lists to maintain (the bug class that dropped
 * TokenizeControls' styles in the universal panel).
 *
 * ponytail: injects a superset of styles into any shadow root; harmless
 * because CSS-module class names are hashed and the root is isolated.
 */
const moduleCss = import.meta.glob('/src/**/*.module.css', {
  query: '?inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const allModuleCss: string[] = Object.values(moduleCss);
