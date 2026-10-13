import { isTihokaDebug } from './TihokaDebug';

const DEBUG_ENABLED = isTihokaDebug();

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
