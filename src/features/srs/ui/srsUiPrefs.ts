import { useSyncExternalStore } from 'react';
import type { SrsVariantToggles, VariantId } from '@/entities/srs/types';
import { STORAGE_KEYS } from '@/shared/config/config';
import { setStorage } from '@/shared/lib/chrome-apis';

export interface SrsUiPrefs {
  readonly dayStartHour: number;
  readonly showStudySummary: 'finished' | 'always' | 'never';
  readonly shuffleReviews: boolean;
  readonly swipeToAnswer: boolean;
  readonly answerFromFront: boolean;
  readonly hideProgress: boolean;
  readonly startWith: 'reviews' | 'new';
  readonly customizePerDeck: boolean;
  readonly newPerDay: number;
  readonly cardsPerBatch: number;
  readonly graduatePasses: number | null;
  readonly editPaneWidth: number | null;
  readonly variantToggles: Readonly<Record<VariantId, SrsVariantToggles>>;
}

const STORAGE_KEY = 'cell.srs.uiPrefs';

export const SRS_UI_PREF_DEFAULTS: SrsUiPrefs = {
  dayStartHour: 4,
  showStudySummary: 'finished',
  shuffleReviews: false,
  swipeToAnswer: false,
  answerFromFront: true,
  hideProgress: false,
  startWith: 'new',
  customizePerDeck: false,
  newPerDay: 10,
  cardsPerBatch: 5,
  graduatePasses: null,
  editPaneWidth: null,
  variantToggles: {},
};

function load(): SrsUiPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return SRS_UI_PREF_DEFAULTS;
    return { ...SRS_UI_PREF_DEFAULTS, ...(JSON.parse(raw) as Partial<SrsUiPrefs>) };
  } catch {
    return SRS_UI_PREF_DEFAULTS;
  }
}

let prefs: SrsUiPrefs = load();
const listeners = new Set<() => void>();

void setStorage({
  [STORAGE_KEYS.SRS_UI_PREFS_MIRROR]: { dayStartHour: prefs.dayStartHour },
}).catch(() => undefined);

export function getSrsUiPrefs(): SrsUiPrefs {
  return prefs;
}

export function setSrsUiPrefs(patch: Partial<SrsUiPrefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable — prefs still apply for this session
  }
  void setStorage({
    [STORAGE_KEYS.SRS_UI_PREFS_MIRROR]: { dayStartHour: prefs.dayStartHour },
  }).catch(() => undefined);
  for (const listener of listeners) listener();
}

/** Persist one toggle dimension of a variant — survives across cards and sessions. */
export function setVariantToggle(variantId: VariantId, patch: SrsVariantToggles): void {
  const current = prefs.variantToggles[variantId] ?? {};
  setSrsUiPrefs({
    variantToggles: { ...prefs.variantToggles, [variantId]: { ...current, ...patch } },
  });
}

export function resetSrsUiPrefs(): void {
  prefs = SRS_UI_PREF_DEFAULTS;
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  for (const listener of listeners) listener();
}

export function useSrsUiPrefs(): SrsUiPrefs {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => { listeners.delete(callback); };
    },
    () => prefs,
    () => prefs,
  );
}
