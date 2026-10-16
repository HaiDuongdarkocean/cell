import { espeakIpas, supportsEspeakIpa } from '@/features/pronunciation';
import type { EspeakPhonemeEngine } from '@/features/pronunciation';

/**
 * Third-tier reading source for tokenized surfaces: dictionary readings win,
 * then frequency-row readings, then eSpeak IPA for the terms still uncovered.
 * English-only (the bundled phoneme engine ships no other voices) — other
 * language profiles get an empty map and keep their own annotation.
 * Returned values are the raw IPA string — the popup adds its own /…/
 * wrapper for IPA readings, so tokens keep the bare reading.
 */
// Contiguous main-thread budget per slice — raw toIpa is ~0.1ms/term so a
// slice covers ~100 terms; the cap guards slower engines and message-
// response callbacks are macrotasks that must not queue behind a fat slice.
const ESPEAK_SLICE_BUDGET_MS = 12;

// Slices yield as background-priority tasks where the platform supports it —
// the sweep is prefetch work, so message-delivery callbacks, binds and paint
// must preempt it instead of queueing behind it. Without postTask the
// fallback setTimeout(0) keeps the old behaviour (still bounded by the slice
// budget, just not preemptible mid-gap).
type PostTaskScheduler = { postTask?: (cb: () => void, opts?: { priority: string }) => Promise<unknown> };
function yieldBackground(): Promise<void> {
  const s = (globalThis as { scheduler?: PostTaskScheduler }).scheduler;
  if (s?.postTask) return s.postTask(() => {}, { priority: 'background' }).then(() => undefined);
  return new Promise((r) => setTimeout(r, 0));
}

export async function resolveEspeakReadings(
  langCode: string,
  terms: readonly string[],
  resolved: (term: string) => string | undefined,
  engine?: EspeakPhonemeEngine,
  onBatch?: (batch: ReadonlyMap<string, string>) => void,
  waitAfterFirstSlice?: () => Promise<unknown>,
  foregroundCount = 0,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!supportsEspeakIpa(langCode)) return out;
  // `resolved` is re-evaluated per term so coverage that lands mid-stream
  // (dictionary leg) prunes later work — eager callers pass a live lookup.
  // Time-slicing keeps the first IPA patch fast — a single ~500-term pass on
  // a dict-less profile costs ~2s; the first slice lands inside ~12ms. The
  // macrotask yield between slices keeps paint/input/message callbacks
  // responsive since each WASM call is synchronous CPU on the content-script
  // main thread.
  // waitAfterFirstSlice gates everything past slice 1 on a coverage signal
  // (e.g. the dictionary leg) — without it, an eager sweep over thousands of
  // terms starves the same main thread that handles message responses.
  let i = 0;
  let first = true;
  while (i < terms.length) {
    if (!first) {
      await waitAfterFirstSlice?.().catch(() => undefined);
      // The visible prefix (callers order it first) must keep foreground pace
      // or on-screen readings starve; the offscreen tail yields as background
      // work so it can never delay a flush or message callback.
      if (i < foregroundCount) await new Promise((r) => setTimeout(r, 0));
      else await yieldBackground();
    }
    first = false;
    const deadline = performance.now() + ESPEAK_SLICE_BUDGET_MS;
    const slice: string[] = [];
    while (i < terms.length && performance.now() < deadline) {
      const term = terms[i++];
      if (!resolved(term)) slice.push(term);
    }
    const ipas = await espeakIpas(slice, langCode, engine);
    if (ipas.size > 0) {
      const batch = new Map<string, string>();
      for (const [term, ipa] of ipas) {
        out.set(term, ipa);
        batch.set(term, ipa);
      }
      onBatch?.(batch);
    }
  }
  return out;
}
