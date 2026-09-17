import type { IconCatalogKey } from '@/shared/icons';

export type SubtitleVisibility = 'none' | 'native' | 'target' | 'both';
export type PausePoint = 'none' | 'start' | 'end';
export type RepeatCount = 1 | 2 | 3;
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];
export type AfterCue = 'continue' | 'wait' | 'loop';

export interface StudyStep {
  subtitle: SubtitleVisibility;
  pause: PausePoint;
  repeat: RepeatCount;
  speed: PlaybackSpeed;
  after: AfterCue;
  seek?: boolean;
}

export interface StudyMode {
  id: string;
  type: 'preset' | 'custom';
  icon: IconCatalogKey;
  title: string;
  description: string;
  steps: StudyStep[];
}

export type PauseOnUnknownPoint = 'OFF' | 'START' | 'END';
export type UnknownScope = 'FREQ_LIST' | 'ALL';

export interface UnknownCueHit {
  readonly term: string;
  readonly offset: number;
}

export interface StudyModeAdvancedSettings {
  skipNoDialogue: 'OFF' | '2X' | '4X' | '6X' | '8X' | 'JUMP';
  removeBracketed: boolean;
  pauseOnUnknown: PauseOnUnknownPoint;
  unknownScope: UnknownScope;
  popupOnAutoPause: boolean;
  popupCloseOnResume: boolean;
}

export interface StudyModeState {
  version: number;
  activeModeId: string;
  customModes: StudyMode[];
  advanced: StudyModeAdvancedSettings;
}
