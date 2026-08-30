/**
 * Ocean Pronunciation Engine types.
 *
 * SSOT for pronunciation data flowing from the phoneme engine through the
 * dictionary popup UI. All consumers (audio player, settings, popup) should
 * import from here rather than from eSpeak internals.
 */

/** Classification of a phoneme for UI styling and duration weighting. */
export type PhonemeType =
  | 'consonant'
  | 'vowel'
  | 'diphthong'
  | 'stress'
  | 'separator';

/** A single IPA phoneme with an estimated timeline. */
export interface Phoneme {
  /** IPA string, e.g. "tʃ", "əʊ", "ˈ". */
  readonly ipa: string;
  /** Estimated start time within the word audio, in milliseconds. */
  readonly startMs: number;
  /** Estimated end time within the word audio, in milliseconds. */
  readonly endMs: number;
  /** Phoneme classification for UI styling. */
  readonly type: PhonemeType;
}

/** Audio payload returned by a pronunciation engine. */
export interface PronunciationAudio {
  /** Raw audio samples (mono). */
  readonly samples: Float32Array;
  /** Sample rate, e.g. 22050. */
  readonly sampleRate: number;
  /** Audio source that produced this buffer. */
  readonly source: AudioEngineKind;
  /** Duration in seconds, derived from samples / sampleRate. */
  readonly duration: number;
}

/** Available audio engines, ordered by default fallback priority. */
export type AudioEngineKind =
  | 'native'
  | 'supertonic'
  | 'browserTts'
  | 'espeak';

/** Metadata attached to every PronunciationResult. */
export interface PronunciationMetadata {
  /** Phoneme engine used, e.g. "espeak-phonemes". */
  readonly engine: string;
  /** Engine version or data version. */
  readonly engineVersion: string;
  /** Where the IPA came from: eSpeak or an existing dictionary. */
  readonly source: 'espeak' | 'dictionary';
}

/** Structured pronunciation data for a word or phrase. */
export interface PronunciationResult {
  /** Source text. */
  readonly text: string;
  /** BCP-47 / ISO language code the result applies to. */
  readonly language: string;
  /** Full IPA string, e.g. "həlˈəʊ". */
  readonly ipa: string;
  /** Individual phonemes with estimated timeline. */
  readonly phonemes: readonly Phoneme[];
  /** Word audio (null if unavailable or not requested). */
  readonly audio: PronunciationAudio | null;
  /** Debug / provenance metadata. */
  readonly metadata: PronunciationMetadata;
}
