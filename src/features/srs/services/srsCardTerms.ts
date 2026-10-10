// srsCardTerms — session cache + change fan-out for the token card layer.
// Card existence is a per-language term set (SRS_CARDS_TERMS): fetched once
// per language, invalidated by SRS_CARDS_CHANGED broadcasts (mirrors the
// wordStatusEvents/wordStatusCrossTab pattern, folded into one module — the
// relay installs lazily on first use so non-tokenizing contexts never pay
// for a listener).

import { onMessage } from '@/shared/lib/chrome-apis/runtime';
import { messagePayload } from '@/entities/message/payload';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { SrsCardsChangedPayload } from '@/entities/message';
import { getSrsCardTerms } from './addToOceanSrs';

export type SrsCardsChangedListener = (langCode: string) => void;

const cache = new Map<string, Promise<Set<string>>>();
const listeners = new Set<SrsCardsChangedListener>();
let relayInstalled = false;

export function emitSrsCardsChanged(langCode: string): void {
  cache.delete(langCode);
  for (const listener of [...listeners]) {
    listener(langCode);
  }
}

function ensureRelay(): void {
  if (relayInstalled) return;
  relayInstalled = true;
  onMessage((message: unknown): boolean => {
    const payload = messagePayload<SrsCardsChangedPayload>(message, MESSAGE_TYPES.SRS_CARDS_CHANGED);
    if (payload) emitSrsCardsChanged(payload.langCode);
    return false;
  });
}

export function onSrsCardsChanged(listener: SrsCardsChangedListener): () => void {
  ensureRelay();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Carded-term set for a language — memoized promise so a burst of metadata
 *  flushes triggers exactly one SRS_CARDS_TERMS request per session. A failed
 *  fetch is dropped from the cache so the next flush retries. */
export function getSrsCardTermSet(langCode: string): Promise<Set<string>> {
  ensureRelay();
  let pending = cache.get(langCode);
  if (!pending) {
    pending = getSrsCardTerms(langCode).catch((err: unknown) => {
      cache.delete(langCode);
      throw err;
    });
    cache.set(langCode, pending);
  }
  return pending;
}

export function invalidateSrsCardTermSet(langCode?: string): void {
  if (langCode === undefined) {
    cache.clear();
  } else {
    cache.delete(langCode);
  }
}

/** Test seam — drop the lazy runtime listener between tests. */
export function resetSrsCardTermSetForTest(): void {
  cache.clear();
  listeners.clear();
}
