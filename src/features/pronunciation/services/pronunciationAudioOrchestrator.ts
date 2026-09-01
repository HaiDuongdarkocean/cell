/**
 * Pronunciation audio orchestrator.
 *
 * Runs the `PronunciationSettings.fallbackEngines` chain for word audio.
 * Each engine is implemented as a provider that returns `AudioItem[]`.
 * The orchestrator walks the chain in order, aggregates results, and marks
 * the first item from the first non-empty provider as `defaultSelected`.
 */

import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message/types';
import type { AudioItem } from '@/features/dictionaryPopup/types';
import type {
  FetchCommunityAudioResponse,
  FetchLocalAudioResponse,
  TtsFetchAudioResponse,
} from '@/features/dictionaryPopup/types';
import type { AudioEngineKind } from '../types';
import type { PronunciationSettings } from '@/entities/settings/types';

export interface PronunciationAudioProvider {
  resolve(term: string, langCode: string): Promise<readonly AudioItem[]>;
}

/** Provider backed by the local Forvo/Lingvo DSL package. */
export class LocalAudioProvider implements PronunciationAudioProvider {
  readonly kind: AudioEngineKind = 'localFile';

  resolve(term: string, langCode: string): Promise<readonly AudioItem[]> {
    return sendMessage<MessageResponse<FetchLocalAudioResponse>>({
      type: MESSAGE_TYPES.FETCH_LOCAL_AUDIO,
      payload: { tabId: 0, term, langCode, kind: 'word' },
    }).then((res) => (res?.success && res.data?.items ? res.data.items : []));
  }
}

/** Provider backed by Wikimedia Commons / community audio. */
export class CommunityAudioProvider implements PronunciationAudioProvider {
  readonly kind: AudioEngineKind = 'native';

  resolve(term: string, langCode: string): Promise<readonly AudioItem[]> {
    return sendMessage<MessageResponse<FetchCommunityAudioResponse>>({
      type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
      payload: { tabId: 0, term, langCode, kind: 'word' },
    }).then((res) => (res?.success && res.data?.items ? res.data.items : []));
  }
}

/** Provider backed by Google Translate TTS (word audio). */
export class TtsAudioProvider implements PronunciationAudioProvider {
  readonly kind: AudioEngineKind = 'browserTts';

  resolve(term: string, langCode: string): Promise<readonly AudioItem[]> {
    return sendMessage<MessageResponse<TtsFetchAudioResponse>>({
      type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
      payload: { tabId: 0, text: term, langCode },
    }).then((res) => {
      if (!res?.success || !res.data?.url) return [];
      return [
        {
          id: `tts-word-${term}-${langCode}`,
          kind: 'word' as const,
          source: 'system-tts' as const,
          label: `${term} · TTS`,
          state: 'idle' as const,
          url: res.data.url,
          defaultSelected: false,
        },
      ];
    });
  }
}

/** Placeholder provider for Supertonic cloud TTS. */
export class SupertonicAudioProvider implements PronunciationAudioProvider {
  readonly kind: AudioEngineKind = 'supertonic';

  resolve(): Promise<readonly AudioItem[]> {
    return Promise.resolve([]);
  }
}

/** Placeholder provider for the on-device eSpeak TTS engine. */
export class EspeakAudioProvider implements PronunciationAudioProvider {
  readonly kind: AudioEngineKind = 'espeak';

  resolve(): Promise<readonly AudioItem[]> {
    return Promise.resolve([]);
  }
}

const providerFactories: Record<AudioEngineKind, () => PronunciationAudioProvider> = {
  localFile: () => new LocalAudioProvider(),
  native: () => new CommunityAudioProvider(),
  supertonic: () => new SupertonicAudioProvider(),
  browserTts: () => new TtsAudioProvider(),
  espeak: () => new EspeakAudioProvider(),
};

/** Orchestrate word-audio lookup across the configured fallback chain. */
export class PronunciationAudioOrchestrator {
  private readonly providers: readonly PronunciationAudioProvider[];

  constructor(settings: PronunciationSettings) {
    this.providers = settings.fallbackEngines
      .map((kind) => providerFactories[kind]?.())
      .filter((p): p is PronunciationAudioProvider => p !== undefined);
  }

  async resolve(term: string, langCode: string): Promise<readonly AudioItem[]> {
    const all: AudioItem[] = [];
    let selectedSet = false;

    for (const provider of this.providers) {
      try {
        const items = await provider.resolve(term, langCode);
        if (items.length === 0) continue;

        const withSelection = items.map((item, index) => ({
          ...item,
          defaultSelected: !selectedSet && index === 0,
        }));
        all.push(...withSelection);
        selectedSet = true;
      } catch {
        // A single provider failing should not break the fallback chain.
        // The next provider in the user-configured order is tried instead.
      }
    }

    return all;
  }
}
