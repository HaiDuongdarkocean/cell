import { t } from '@/shared/i18n';
import type { TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';

const ANNOUNCER_ID = 'cell-token-selection-announcer';

function ensureRegion(doc: Document): HTMLElement {
  const existing = doc.getElementById(ANNOUNCER_ID);
  if (existing) return existing;
  const region = doc.createElement('div');
  region.id = ANNOUNCER_ID;
  region.setAttribute('data-cell-id', 'token-selection-announcer');
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute(
    'style',
    'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0',
  );
  (doc.body ?? doc.documentElement).appendChild(region);
  return region;
}

/** Announce bulk-selection count changes through a shared visually-hidden
 *  live region. Returns the unsubscribe fn. */
export function createSelectionAnnouncer(stateStore: TokenizeStateStore): () => void {
  let previous = stateStore.getState().selectedTerms.size;
  return stateStore.subscribe((state) => {
    const next = state.selectedTerms.size;
    if (next === previous) return;
    previous = next;
    ensureRegion(document).textContent =
      next === 0 ? t('tokenize.selection.cleared') : t('tokenize.selection.count', [next]);
  });
}
