// devMode — single source of truth for Vite dev mode detection.
//
// import.meta.env.DEV is a Vite-injected compile-time constant. It cannot be
// used directly in entrypoint files that Jest imports (CJS parse error), so
// this module isolates it. Tests mock this module via jest.mock.

/** True when running under `vite` (serve). False in production build. */
export const isDevMode: boolean = import.meta.env.DEV;
