/**
 * Shared config: constants, message types, URLs.
 *
 * Re-export everything from the 3 config files so callers can import from
 * a single barrel. Keep exhaustive re-exports simple — these are leaf deps.
 */
export * from './config';
export * from './messages';
export * from './urls';
