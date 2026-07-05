/**
 * Minimal type declarations for mux.js (the library ships without TypeScript
 * types). Only the `mp4.Transmuxer` surface used by `tsTransmuxer.ts` is
 * declared.
 */
/* eslint-disable @typescript-eslint/no-unused-vars -- ambient .d.ts declarations are type-only by design */

declare module 'mux.js' {
  interface TransmuxerSegment {
    type: string;
    data: Uint8Array;
    initSegment?: Uint8Array;
    dataOffset?: number;
  }

  class Transmuxer {
    on(event: 'data', handler: (segment: TransmuxerSegment) => void): void;
    on(event: 'done', handler: () => void): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler?: (...args: unknown[]) => void): void;
    push(data: Uint8Array): void;
    flush(): void;
    reset(): void;
    dispose(): void;
    setBaseMediaDecodeTime(time: number): void;
  }

  export const mp4: {
    Transmuxer: typeof Transmuxer;
    [key: string]: unknown;
  };

  const muxjs: {
    mp4: { Transmuxer: typeof Transmuxer };
    codecs: unknown;
    flv: unknown;
    mp2t: unknown;
    partial: unknown;
  };

  export default muxjs;
}
