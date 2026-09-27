import type { WordStatus } from '@/entities/dictionary';

export interface WordStatusChangedDetail {
  readonly langCode: string;
  readonly term: string;
  readonly status: WordStatus;
}

export interface WordStatusRemovedDetail {
  readonly langCode: string;
  readonly term: string;
}

export type WordStatusChangedListener = (detail: WordStatusChangedDetail) => void;
export type WordStatusRemovedListener = (detail: WordStatusRemovedDetail) => void;

export type WordStatusReloadListener = (langCode: string) => void;

const changedListeners = new Set<WordStatusChangedListener>();
const removedListeners = new Set<WordStatusRemovedListener>();
const reloadListeners = new Set<WordStatusReloadListener>();

export function emitWordStatusChanged(detail: WordStatusChangedDetail): void {
  for (const listener of [...changedListeners]) {
    listener(detail);
  }
}

export function emitWordStatusRemoved(detail: WordStatusRemovedDetail): void {
  for (const listener of [...removedListeners]) {
    listener(detail);
  }
}

export function onWordStatusChanged(listener: WordStatusChangedListener): () => void {
  changedListeners.add(listener);
  return () => {
    changedListeners.delete(listener);
  };
}

export function onWordStatusRemoved(listener: WordStatusRemovedListener): () => void {
  removedListeners.add(listener);
  return () => {
    removedListeners.delete(listener);
  };
}

export function emitWordStatusesReload(langCode: string): void {
  for (const listener of [...reloadListeners]) {
    listener(langCode);
  }
}

export function onWordStatusesReload(listener: WordStatusReloadListener): () => void {
  reloadListeners.add(listener);
  return () => {
    reloadListeners.delete(listener);
  };
}
