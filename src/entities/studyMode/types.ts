import type { IconCatalogKey } from '@/shared/icons';

export type SubtitleVisibility = 'none' | 'native' | 'target' | 'both';
export type PausePoint = 'none' | 'start' | 'end';
export type RepeatCount = 1 | 2 | 3;
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5;
export type AfterCue = 'continue' | 'wait' | 'loop';

export interface StudyStep {
  subtitle: SubtitleVisibility;
  pause: PausePoint;
  repeat: RepeatCount;
  speed: PlaybackSpeed;
  after: AfterCue;
}

export interface StudyMode {
  id: string;
  type: 'preset' | 'custom';
  icon: IconCatalogKey;
  title: string;
  description: string;
  steps: StudyStep[];
}

export interface StudyModeAdvancedSettings {
  skipNoDialogue: 'OFF' | '2X' | '4X' | '6X' | '8X' | 'JUMP';
  removeBracketed: boolean;
}

export interface StudyModeState {
  version: number;
  activeModeId: string;
  customModes: StudyMode[];
  advanced: StudyModeAdvancedSettings;
}
