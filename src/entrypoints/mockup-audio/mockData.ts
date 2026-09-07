import type { AudioEngineKind, LocalFileAudioSettings, PronunciationSettings, TtsSettings, TtsVoiceRow } from '@/entities/settings/types';
import type { TtsVoiceInfo } from '@/features/dictionaryPopup/services/ttsEngineService';
import { DEFAULT_PRONUNCIATION_SETTINGS } from '@/shared/config/config';
import { DEFAULT_TTS_SETTINGS } from '@/features/tts/ui/TtsVoiceManagerPanel';

/** Ordered engine identifiers for the audio fallback chain. */
export const ENGINE_LIST: AudioEngineKind[] = [
  'localFile',
  'native',
  'supertonic',
  'browserTts',
  'espeak',
];

/** Friendly English labels for each engine (proposed copy audit). */
export const ENGINE_LABELS: Record<AudioEngineKind, string> = {
  localFile: 'Forvo audio (offline)',
  native: 'Community audio (Wikimedia)',
  supertonic: 'Cloud speech (Supertonic)',
  browserTts: 'Browser speech',
  espeak: 'Device speech (eSpeak)',
};

export const PACKAGE_TYPE_OPTIONS = [
  { value: 'single', label: 'Single zip file' },
  { value: 'split', label: 'Split by first letter' },
];

export const MAX_DISPLAY_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
];

export const AUTOPLAY_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
];

/** Mock voices used across the TTS tester and slot selection. */
export const MOCK_VOICES: TtsVoiceInfo[] = [
  { voiceName: 'Google US English', lang: 'en-US' },
  { voiceName: 'Microsoft David', lang: 'en-US' },
  { voiceName: 'Google UK English', lang: 'en-GB' },
  { voiceName: 'Samantha', lang: 'en-US' },
  { voiceName: 'Eddy (English AU)', lang: 'en-AU' },
  { voiceName: 'Microsoft Anna', lang: 'en-US' },
];

/** Tester row state — mirrors TtsVoiceRow plus a selection checkbox. */
export interface TesterVoiceRow extends TtsVoiceRow {
  selected: boolean;
}

export const DEFAULT_TESTER_VOICES: TesterVoiceRow[] = MOCK_VOICES.map((v, i) => ({
  voiceName: v.voiceName,
  lang: v.lang,
  order: i + 1,
  selected: i < 2,
}));

/** Starting mock state matching PronunciationSettings + TtsSettings. */
export const DEFAULT_MOCK_AUDIO_SETTINGS: {
  pronunciation: PronunciationSettings;
  tts: TtsSettings;
} = {
  pronunciation: DEFAULT_PRONUNCIATION_SETTINGS,
  tts: {
    ...DEFAULT_TTS_SETTINGS,
    voices: [MOCK_VOICES[0].voiceName, MOCK_VOICES[1].voiceName],
    savedVoices: [MOCK_VOICES[0], MOCK_VOICES[1]].map((v, i) => ({ ...v, order: i + 1 })),
    downloadedLanguages: ['en'],
    localTtsLanguage: 'en',
  },
};

/** Reorder an engine in the fallback chain. */
export function moveEngine(
  list: readonly AudioEngineKind[],
  index: number,
  direction: -1 | 1,
): AudioEngineKind[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

/** Immutable patch for the local file package settings. */
export function updateLocalFile(
  local: LocalFileAudioSettings,
  partial: Partial<LocalFileAudioSettings>,
): LocalFileAudioSettings {
  return { ...local, ...partial };
}

/** Pad a string array of voice names to exactly three nullable slots. */
export function padSlots(voices: readonly string[]): (string | null)[] {
  const slots: (string | null)[] = [null, null, null];
  for (let i = 0; i < Math.min(voices.length, 3); i++) {
    slots[i] = voices[i] ?? null;
  }
  return slots;
}

/** Extract the base language code, e.g. "en" from "en-US". */
export function langPrefix(lang: string): string {
  return lang.split('-')[0] ?? lang;
}

/** Unique sorted language prefixes from a voice list. */
export function uniqueLangPrefixes(voices: readonly TtsVoiceInfo[]): string[] {
  const set = new Set<string>();
  for (const v of voices) set.add(langPrefix(v.lang));
  return Array.from(set).sort();
}
