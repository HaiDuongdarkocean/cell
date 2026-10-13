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
import { DEFAULT_PRONUNCIATION_SETTINGS, DEFAULT_SETTINGS } from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { decodeBase64ToArrayBuffer, encodeBase64 } from '@/shared/lib/base64';
import { t } from '@/shared/i18n';
import type { MessageResponse } from '@/entities/message/types';
import type { AudioItem, AudioKind } from '@/entities/dictionary';
import type {
  FetchCommunityAudioResponse,
  FetchLocalAudioResponse,
  TtsFetchAudioResponse,
} from '@/entities/dictionary';
import type {
  PronunciationEspeakTtsResult,
  PronunciationSupertonicTtsResult,
} from '@/entities/message/types';
import type { AudioEngineKind } from '../types';
import type { LocalFileAudioSettings, PronunciationSettings } from '@/entities/settings/types';
import { getFileHandle, verifyPermission } from '@/shared/lib/storage/localFileHandleStorage';

export interface PronunciationAudioProvider {
  readonly kind: AudioEngineKind;
  resolve(term: string, langCode: string, kind?: AudioKind): Promise<readonly AudioItem[]>;
}

function toUint8Array(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return new Uint8Array(value);
  if (value !== null && typeof value === 'object') {
    return new Uint8Array(Object.values(value as Record<string, number>));
  }
  return undefined;
}

export async function ensureLocalAudioAccess(
  localFile: LocalFileAudioSettings | undefined,
): Promise<void> {
  if (!localFile) return;
  if (typeof window === 'undefined' || window.location.protocol !== 'chrome-extension:') return;
  const handleId =
    localFile.packageType === 'single'
      ? localFile.audioArchiveHandleId
      : localFile.splitArchiveDirectoryHandleId;
  if (!handleId) return;
  try {
    const handle = await getFileHandle(handleId);
    if (!handle) return;
    if ((await handle.queryPermission({ mode: 'read' })) === 'granted') return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    await verifyPermission(handle, 'read');
  } catch {
    return;
  }
}

/** Provider backed by the local Forvo/Lingvo DSL package. */
export class LocalAudioProvider implements PronunciationAudioProvider {
  readonly kind: AudioEngineKind = 'localFile';

  constructor(private readonly localFile?: LocalFileAudioSettings) {}

  async resolve(term: string, langCode: string): Promise<readonly AudioItem[]> {
    await ensureLocalAudioAccess(this.localFile);
    const res = await sendMessage<MessageResponse<FetchLocalAudioResponse>>({
      type: MESSAGE_TYPES.FETCH_LOCAL_AUDIO,
      payload: { tabId: 0, term, langCode, kind: 'word' },
    });
    if (!res?.success || !res.data?.items) return [];
    return res.data.items.map((item) => {
      const { audioBytesB64, ...rest } = item;
      const audioBytes =
        toUint8Array(item.audioBytes) ??
        (audioBytesB64 ? new Uint8Array(decodeBase64ToArrayBuffer(audioBytesB64)) : undefined);
      return { ...rest, audioBytes };
    });
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

/** Provider backed by Google Translate TTS (browser voice). */
export class TtsAudioProvider implements PronunciationAudioProvider {
  readonly kind: AudioEngineKind = 'browserTts';

  resolve(term: string, langCode: string, kind: AudioKind = 'word'): Promise<readonly AudioItem[]> {
    return sendMessage<MessageResponse<TtsFetchAudioResponse>>({
      type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
      payload: { tabId: 0, text: term, langCode },
    }).then((res) => {
      if (!res?.success || !res.data?.url) return [];
      return [
        {
          id: `tts-${kind}-${term}-${langCode}`,
          kind,
          source: 'system-tts' as const,
          label: kind === 'sentence' ? t('dict.audio.ttsSentence') : `${term} · TTS`,
          state: 'idle' as const,
          url: res.data.url,
          defaultSelected: false,
        },
      ];
    });
  }
}

/** Provider backed by the offscreen Supertonic ONNX TTS engine (cloud voices). */
export class SupertonicAudioProvider implements PronunciationAudioProvider {
  readonly kind: AudioEngineKind = 'supertonic';

  resolve(term: string, langCode: string, kind: AudioKind = 'word'): Promise<readonly AudioItem[]> {
    return sendMessage<MessageResponse<PronunciationSupertonicTtsResult>>({
      type: MESSAGE_TYPES.PRONUNCIATION_SUPERTONIC_TTS,
      payload: { text: term, langCode },
    }).then((res) => {
      if (!res?.success || !res.data?.items) return [];
      return res.data.items
        .filter((item) => item.audioBytesB64)
        .map((item) => ({
          id: `supertonic-${kind}-${term}-${langCode}-${item.voice}`,
          kind,
          source: 'cloud-tts' as const,
          label: kind === 'sentence' ? t('dict.audio.sentenceVoice', [item.voice]) : `${term} · ${item.voice}`,
          state: 'idle' as const,
          audioBytes: new Uint8Array(decodeBase64ToArrayBuffer(item.audioBytesB64)),
          defaultSelected: false,
        }));
    });
  }
}

/** Provider backed by the offscreen eSpeak TTS engine. */
export class EspeakAudioProvider implements PronunciationAudioProvider {
  readonly kind: AudioEngineKind = 'espeak';

  resolve(term: string, langCode: string): Promise<readonly AudioItem[]> {
    return sendMessage<MessageResponse<PronunciationEspeakTtsResult>>({
      type: MESSAGE_TYPES.PRONUNCIATION_ESPEAK_TTS,
      payload: { text: term, langCode },
    }).then((res) => {
      const audioBytes = res?.success
        ? toUint8Array(res.data?.audioBytes) ??
          (res.data?.audioBytesB64
            ? new Uint8Array(decodeBase64ToArrayBuffer(res.data.audioBytesB64))
            : undefined)
        : undefined;
      if (!audioBytes) return [];
      return [
        {
          id: `espeak-word-${term}-${langCode}`,
          kind: 'word' as const,
          source: 'espeak' as const,
          label: `${term} · eSpeak`,
          state: 'idle' as const,
          audioBytes,
          defaultSelected: false,
        },
      ];
    });
  }
}

const providerFactories: Record<
  AudioEngineKind,
  (settings: PronunciationSettings) => PronunciationAudioProvider
> = {
  localFile: (s) => new LocalAudioProvider(s.localFile),
  native: () => new CommunityAudioProvider(),
  supertonic: () => new SupertonicAudioProvider(),
  browserTts: () => new TtsAudioProvider(),
  espeak: () => new EspeakAudioProvider(),
};

/** Single-engine provider for per-source testing (bypasses the chain). */
export function createEngineProvider(
  kind: AudioEngineKind,
  settings: PronunciationSettings,
): PronunciationAudioProvider {
  return providerFactories[kind](settings);
}

/** Playable URL for an audio item — blob for in-memory bytes. */
export function audioItemUrl(item: AudioItem): string | undefined {
  return (
    item.url ??
    (item.audioBytes
      ? URL.createObjectURL(new Blob([new Uint8Array(item.audioBytes)]))
      : undefined)
  );
}

// Supertonic's first synthesis after launch loads the ONNX sessions (~20s).
const PROVIDER_TIMEOUT_MS = 30_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

/** Orchestrate word-audio lookup across the configured fallback chain. */
export class PronunciationAudioOrchestrator {
  private readonly providers: readonly PronunciationAudioProvider[];

  constructor(settings: PronunciationSettings) {
    this.providers = settings.fallbackEngines
      .filter((kind) => kind !== 'espeak' || settings.downloadEspeakTtsData)
      .map((kind) => providerFactories[kind]?.(settings))
      .filter((p): p is PronunciationAudioProvider => p !== undefined);
  }

  resolve(term: string, langCode: string): Promise<readonly AudioItem[]> {
    return this.walk(this.providers, term, langCode, 'word');
  }

  /** Sentence audio follows the same configured chain, restricted to engines
   *  that synthesize arbitrary text — cloud voices and browser voice. */
  resolveSentence(text: string, langCode: string): Promise<readonly AudioItem[]> {
    return this.walk(
      this.providers.filter((p) => SENTENCE_ENGINE_KINDS.has(p.kind)),
      text,
      langCode,
      'sentence',
    );
  }

  private async walk(
    providers: readonly PronunciationAudioProvider[],
    text: string,
    langCode: string,
    kind: AudioKind,
  ): Promise<readonly AudioItem[]> {
    const all: AudioItem[] = [];
    let selectedSet = false;

    for (const provider of providers) {
      try {
        const items = await withTimeout(
          provider.resolve(text, langCode, kind),
          PROVIDER_TIMEOUT_MS,
          provider.kind,
        );
        if (items.length === 0) continue;

        const withSelection = items.map((item, index) => ({
          ...item,
          defaultSelected: !selectedSet && index === 0,
        }));
        all.push(...withSelection);
        selectedSet = true;
        break; // first non-empty provider wins
      } catch {
        // A single provider failing should not break the fallback chain.
        // The next provider in the user-configured order is tried instead.
      }
    }

    return all;
  }
}

/** Engines that can synthesize arbitrary sentence text. */
const SENTENCE_ENGINE_KINDS: ReadonlySet<AudioEngineKind> = new Set(['supertonic', 'browserTts']);

/** Sentence audio through the user's fallback chain (cloud voices + browser
 *  voice only), loading settings itself for call sites that don't hold them. */
export async function resolveSentenceAudioItems(
  text: string,
  langCode: string,
): Promise<readonly AudioItem[]> {
  const settings = await loadSettings().catch(() => DEFAULT_SETTINGS);
  const orchestrator = new PronunciationAudioOrchestrator(
    settings.pronunciation ?? DEFAULT_PRONUNCIATION_SETTINGS,
  );
  return orchestrator.resolveSentence(text, langCode);
}

/** Self-contained URL for an audio item — byte payloads become a data: URL
 *  so they survive handoff to other documents/contexts (unlike blob:). */
export function audioItemDataUrl(item: AudioItem): string | undefined {
  return item.url
    ?? (item.audioBytes ? `data:audio/wav;base64,${encodeBase64(item.audioBytes)}` : undefined);
}
