import type { StudyMode } from './types';

export const STUDY_MODE_STATE_VERSION = 1;

export const PRESETS: readonly StudyMode[] = [
  {
    id: 'normal',
    type: 'preset',
    icon: 'play',
    title: 'Normal',
    description: 'Both subtitles visible, no auto-pause.',
    steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
  },
  {
    id: 'listen',
    type: 'preset',
    icon: 'volumeHigh',
    title: 'Listen',
    description: 'Hide both subtitles, focus on listening.',
    steps: [{ subtitle: 'none', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
  },
  {
    id: 'read',
    type: 'preset',
    icon: 'bookOpen',
    title: 'Read',
    description: 'Pause at cue start so subtitle can be read.',
    steps: [{ subtitle: 'both', pause: 'start', repeat: 1, speed: 1, after: 'wait' }],
  },
  {
    id: 'listen-check',
    type: 'preset',
    icon: 'eyeOff',
    title: 'Listen-Check',
    description: 'Hide subtitles while playing, then pause and reveal.',
    steps: [{ subtitle: 'none', pause: 'end', repeat: 1, speed: 1, after: 'wait' }],
  },
  {
    id: 'hybrid',
    type: 'preset',
    icon: 'layers',
    title: 'Hybrid',
    description: 'Native → target → audio only, in one cue loop.',
    steps: [
      { subtitle: 'native', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
      { subtitle: 'target', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
      { subtitle: 'none', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
    ],
  },
  {
    id: 'dictation',
    type: 'preset',
    icon: 'pencil',
    title: 'Dictation',
    description: 'Play the sentence, then type and check.',
    steps: [{ subtitle: 'none', pause: 'end', repeat: 2, speed: 0.75, after: 'wait' }],
  },
  {
    id: 'cloze',
    type: 'preset',
    icon: 'scanText',
    title: 'Cloze',
    description: 'Fill in missing target words.',
    steps: [{ subtitle: 'target', pause: 'end', repeat: 1, speed: 1, after: 'wait' }],
  },
] as const;

export const PRESET_LOOKUP = new Map(PRESETS.map((p) => [p.id, p]));
