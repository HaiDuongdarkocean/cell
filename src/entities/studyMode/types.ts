import type { IconCatalogKey } from '@/shared/icons';
import type { MessageKey } from '@/shared/i18n';

export type SubtitleVisibility = 'none' | 'native' | 'target' | 'both';
/** Step-level sentinel: visibility resolved per cue from the band probe at
 *  each cue boundary. Never emitted as a PlaybackAction — actions always
 *  carry a concrete SubtitleVisibility. */
export type StepSubtitle = SubtitleVisibility | 'adaptive';
export type AdaptiveCueBand = 'easy' | 'i1' | 'dense';
export type CueBandProbe = (cueIndex: number) => AdaptiveCueBand | null;
/** Cue-entry skip policy resolved against the band probe. Evaluated only
 *  at cue entry (first step); 'non-i1' seeks to the first reachable i1 cue
 *  ahead. Distinct from `seek` (seek-back on step transitions). */
export type StepSkipRule = 'non-i1';
export type PausePoint = 'none' | 'start' | 'end';
export type RepeatCount = 1 | 2 | 3;
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];
export type AfterCue = 'continue' | 'wait' | 'loop';

export interface StudyStep {
  subtitle: StepSubtitle;
  pause: PausePoint;
  repeat: RepeatCount;
  speed: PlaybackSpeed;
  after: AfterCue;
  seek?: boolean;
  skip?: StepSkipRule;
}

export interface StudyMode {
  id: string;
  type: 'preset' | 'custom';
  icon: IconCatalogKey;
  title: string;
  description: string;
  titleKey?: MessageKey;
  descriptionKey?: MessageKey;
  steps: StudyStep[];
}

export type PauseOnUnknownPoint = 'OFF' | 'START' | 'END';
/** Max frequency band an unknown/tracking word may reach and still trigger a
 *  pause — 'advanced' pauses on anything ranked ≤ the advanced threshold,
 *  unlisted words never pause. Levels follow the user-configurable
 *  frequency band thresholds (core/common/general/advanced). */
export type UnknownLevel = 'core' | 'common' | 'general' | 'advanced';

export interface UnknownCueHit {
  readonly term: string;
  readonly offset: number;
}

export interface SubtitleCleanupRule {
  id: string;
  name: string;
  description: string;
  nameKey?: MessageKey;
  descriptionKey?: MessageKey;
  pattern: string;
  replacement?: string;
  enabled: boolean;
  builtin: boolean;
  repeatUntilStable?: boolean;
}

export interface CleanupRulesSetting {
  builtinEnabled: Record<string, boolean>;
  custom: SubtitleCleanupRule[];
}

export interface LocalizedError {
  readonly key: MessageKey;
  readonly params?: readonly (string | number)[];
}

export interface StudyModeAdvancedSettings {
  skipNoDialogue: 'OFF' | '2X' | '4X' | '6X' | '8X' | 'JUMP';
  removeBracketed: boolean;
  pauseOnUnknown: PauseOnUnknownPoint;
  unknownLevel: UnknownLevel;
  popupOnAutoPause: boolean;
  popupCloseOnResume: boolean;
  cleanupRules?: CleanupRulesSetting;
  cueLeadInMs?: number;
}

export interface StudyModeState {
  version: number;
  activeModeId: string;
  customModes: StudyMode[];
  advanced: StudyModeAdvancedSettings;
}
