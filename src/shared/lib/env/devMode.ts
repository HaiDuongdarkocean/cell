// devMode — single source of truth for dev mode detection.
//
// import.meta.env.DEV is true only in `vite` (serve), always false in `vite build`.
// For dev-seed to work with `vite build --mode development`, we check MODE instead.
// Tests mock this module via jest.mock.

/** True when running in development mode (vite serve OR vite build --mode development). */
export const isDevMode: boolean = import.meta.env.DEV || import.meta.env.MODE === 'development';
