declare const __CELL_DEBUG__: string | undefined;

const DEBUG_ENABLED =
  typeof __CELL_DEBUG__ !== 'undefined' && __CELL_DEBUG__ === 'true';

const noop = (..._args: unknown[]): void => {};

export const logger = {
  debug: DEBUG_ENABLED
    ? (...args: unknown[]): void => console.debug(...args)
    : noop,
  info: DEBUG_ENABLED
    ? (...args: unknown[]): void => console.info(...args)
    : noop,
  warn: DEBUG_ENABLED
    ? (...args: unknown[]): void => console.warn(...args)
    : noop,
  error: DEBUG_ENABLED
    ? (...args: unknown[]): void => console.error(...args)
    : noop,
};
