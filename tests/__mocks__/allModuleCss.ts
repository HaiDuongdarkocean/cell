/**
 * Mock for @/shared/lib/shadowRoot/allModuleCss in Jest.
 * The real module uses Vite's import.meta.glob, which is unavailable in Node/jsdom.
 */
export const allModuleCss: string[] = [];
