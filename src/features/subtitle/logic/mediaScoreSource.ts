import { useCuesStore } from '@/features/subtitle/cuesStore';
import type { SrtCue } from '@/entities/media/types';
import { createTokenList, startTokenScoreSource, type ComprehensionStore } from '@/features/tokenize';


import { baseLangCode } from '@/shared/config/languageRegistry';

export interface MediaScoreSourceDeps {
  langCode: string;
  store: ComprehensionStore;
  getCues?: () => readonly SrtCue[];
  subscribeCues?: (listener: (cues: readonly SrtCue[]) => void) => () => void;
}

function cueKey(cues: readonly SrtCue[]): string {
  if (cues.length === 0) return '';
  let len = 0;
  for (const c of cues) len += c.text.length;
  return `${cues.length}:${cues[0]!.start}:${cues[cues.length - 1]!.end}:${len}`;
}

export function startMediaScoreSource(deps: MediaScoreSourceDeps): () => void {
  const lang = baseLangCode(deps.langCode);
  const getCues = deps.getCues ?? (() => useCuesStore.getState().targetCues);
  const subscribeCues =
    deps.subscribeCues ?? ((listener) => useCuesStore.subscribe((s) => s.targetCues, listener));
  return startTokenScoreSource({
    kind: 'media',
    langCode: deps.langCode,
    store: deps.store,
    getSource: getCues,
    signature: cueKey,
    tokenize: (cues) => cues.flatMap((c) => createTokenList(c.text, lang)),
    subscribeChanges: (listener) => subscribeCues(() => listener()),
  });
}
