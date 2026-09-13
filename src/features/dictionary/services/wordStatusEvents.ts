import type { WordStatus } from '@/entities/dictionary';

export interface WordStatusChangedDetail {
  readonly langCode: string;
  readonly term: string;
  readonly status: WordStatus;
}

export type WordStatusChangedListener = (detail: WordStatusChangedDetail) => void;

const listeners = new Set<WordStatusChangedListener>();

export function emitWordStatusChanged(detail: WordStatusChangedDetail): void {
  for (const listener of [...listeners]) {
    listener(detail);
  }
}

export function onWordStatusChanged(listener: WordStatusChangedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
