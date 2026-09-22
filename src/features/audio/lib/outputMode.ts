import type { AudioEngineKind, PronunciationSettings, TtsSettings } from '@/entities/settings/types';
import type { MessageKey } from '@/shared/i18n';

/** User-facing audio output goal. Each mode maps to a hidden engine priority chain. */
export type OutputMode = 'auto' | 'natural' | 'fast' | 'offline' | 'minimal';

/** UI metadata for every output mode. */
export interface OutputModeOption {
  readonly value: OutputMode;
  readonly label: MessageKey;
  readonly desc: MessageKey;
}

/** Ordered list of output modes with label and description. */
export const OUTPUT_MODES: readonly OutputModeOption[] = [
  { value: 'auto', label: 'audio.mode.auto', desc: 'audio.mode.auto.desc' },
  { value: 'natural', label: 'audio.mode.natural', desc: 'audio.mode.natural.desc' },
  { value: 'fast', label: 'audio.mode.fast', desc: 'audio.mode.fast.desc' },
  { value: 'offline', label: 'audio.mode.offline', desc: 'audio.mode.offline.desc' },
  { value: 'minimal', label: 'audio.mode.minimal', desc: 'audio.mode.minimal.desc' },
];

const MODE_CHAINS: Record<OutputMode, readonly AudioEngineKind[]> = {
  auto: ['localFile', 'native', 'supertonic', 'browserTts', 'espeak'],
  natural: ['native', 'localFile', 'browserTts', 'supertonic', 'espeak'],
  fast: ['browserTts', 'native', 'localFile', 'espeak'],
  offline: ['localFile', 'espeak', 'supertonic'],
  minimal: ['browserTts', 'espeak'],
};

/** Returns the full engine priority chain for a given output mode. */
export function getOutputModeChain(mode: OutputMode): AudioEngineKind[] {
  return [...MODE_CHAINS[mode]];
}

/** Runtime readiness status for a single audio engine. */
export type EngineStatus = 'ready' | 'missing' | 'disabled';

/**
 * Determine whether an engine is ready, missing dependencies, or disabled by
 * the current fallback chain.
 *
 * - `disabled` when the engine is not in `pronunciation.fallbackEngines`.
 * - `localFile` is ready when the DSL file is selected and indexed; otherwise missing.
 * - `supertonic` is ready when the English voice pack is downloaded; otherwise missing.
 * - `espeak` is ready when `downloadEspeakTtsData` is enabled; otherwise missing.
 * - `native` and `browserTts` are ready when enabled in the fallback chain.
 */
export function getEngineStatus(
  engine: AudioEngineKind,
  pronunciation: PronunciationSettings,
  tts: TtsSettings,
): EngineStatus {
  if (!pronunciation.fallbackEngines.includes(engine)) {
    return 'disabled';
  }

  switch (engine) {
    case 'localFile':
      return pronunciation.localFile.dslFileHandleId && pronunciation.localFile.lastIndexedAt
        ? 'ready'
        : 'missing';
    case 'supertonic':
      return tts.downloadedLanguages.includes('en') ? 'ready' : 'missing';
    case 'espeak':
      return pronunciation.downloadEspeakTtsData ? 'ready' : 'missing';
    case 'native':
    case 'browserTts':
      return 'ready';
    default:
      return 'disabled';
  }
}
