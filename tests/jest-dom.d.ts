import type * as matchers from '@testing-library/jest-dom/matchers';

declare module 'expect' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface Matchers<R extends void | Promise<void>>
    extends matchers.TestingLibraryMatchers<unknown, R> {}
}
