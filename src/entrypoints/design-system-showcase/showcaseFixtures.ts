import type { LanguageProfile, Settings } from '@/entities/settings';
import type { StudyMode, StudyModeState } from '@/entities/studyMode';
import type { CardCreatorQueueItem } from '@/features/cardCreator/types';
import {
  DEFAULT_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
} from '@/shared/config/config';
import { formatModeDescription } from '@/features/studyModes/lib/formatStepSummary';
import { SHOWCASE_DATA, type DataVariant } from './showcaseParams';

const OVERFLOW_LONG_NAME = `${'A'.repeat(120)}🎌${'あ'.repeat(60)}${'中'.repeat(50)}`;
const OVERFLOW_MIXED = '日本語🎌😀TiếngViệtEnglish한국어中文';

/** Build a mock language profile with all required fields filled. */
function makeLanguageProfile(
  id: string,
  target: string,
  native: string,
  name: string,
  order: number,
): LanguageProfile {
  return {
    id,
    target,
    native,
    name,
    order,
    subtitleOverlayTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
    subtitleOverlayNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
    subtitleOverlayAutoLoad: DEFAULT_SETTINGS.subtitleOverlayAutoLoad,
    subtitleOverlayAutoLoadAsr: DEFAULT_SETTINGS.subtitleOverlayAutoLoadAsr,
    subtitleOverlayAutoTranslate: DEFAULT_SETTINGS.subtitleOverlayAutoTranslate,
    dictionaryPopup: DEFAULT_DICTIONARY_POPUP_SETTINGS,
    resourceIds: [],
  };
}

function buildFullLanguageProfiles(): LanguageProfile[] {
  return [
    makeLanguageProfile('p-en', 'en', '', 'Tiếng Việt → English', 1),
    makeLanguageProfile('p-ja', 'ja', '', 'Tiếng Việt → Japanese', 2),
    makeLanguageProfile('p-ko', 'ko', 'en', 'English → Korean', 3),
  ];
}

const PROFILE_TARGETS = ['en', 'ja', 'ko', 'zh', 'vi', 'es', 'fr', 'de', 'ru', 'it'];

function buildOverflowLanguageProfiles(): LanguageProfile[] {
  const profiles: LanguageProfile[] = [];
  for (let i = 0; i < 50; i += 1) {
    const target = PROFILE_TARGETS[i % PROFILE_TARGETS.length] ?? 'en';
    let name: string;
    if (i === 0) {
      name = OVERFLOW_LONG_NAME;
    } else if (i === 1) {
      name = '';
    } else if (i === 2) {
      name = 'X';
    } else if (i === 3) {
      name = OVERFLOW_MIXED;
    } else {
      name = `Profile ${i + 1} — ${target.toUpperCase()}`;
    }
    profiles.push(makeLanguageProfile(`p-overflow-${i + 1}`, target, i % 2 === 0 ? '' : 'vi', name, i + 1));
  }
  return profiles;
}

export function getMockLanguageProfiles(variant: DataVariant = SHOWCASE_DATA): LanguageProfile[] {
  switch (variant) {
    case 'empty':
      return [];
    case 'overflow':
      return buildOverflowLanguageProfiles();
    case 'full':
    default:
      return buildFullLanguageProfiles();
  }
}

/** Settings seed for the Settings Dialog Page showcase. */
export function getMockSettings(variant: DataVariant = SHOWCASE_DATA): Settings {
  const languageProfiles = getMockLanguageProfiles(variant);
  return {
    ...DEFAULT_SETTINGS,
    universalNativeLanguage: 'vi',
    languageProfiles,
    activeProfileId: languageProfiles[0]?.id ?? null,
  };
}

/** Lightweight profile list used by the Universal Panel header selector. */
export function getMockUniversalPanelProfiles(variant: DataVariant = SHOWCASE_DATA): { readonly id: string; readonly name: string; readonly target: string }[] {
  return getMockLanguageProfiles(variant).map((p) => ({ id: p.id, name: p.name, target: p.target }));
}

function makeCustomMode(id: string, title: string, steps: StudyMode['steps']): StudyMode {
  const mode: StudyMode = {
    id,
    type: 'custom',
    icon: 'slidersHorizontal',
    title,
    description: formatModeDescription({
      id,
      type: 'custom',
      icon: 'slidersHorizontal',
      title,
      description: '',
      steps,
    }),
    steps,
  };
  return mode;
}

function buildFullCustomModes(): StudyMode[] {
  return [
    makeCustomMode('custom-repeat-2', 'Repeat ×2', [
      { subtitle: 'target', pause: 'end', repeat: 2, speed: 1, after: 'continue' },
    ]),
    makeCustomMode('custom-slow', 'Slow listen', [
      { subtitle: 'none', pause: 'none', repeat: 1, speed: 0.75, after: 'continue' },
    ]),
    makeCustomMode('custom-read-pause', 'Read then pause', [
      { subtitle: 'both', pause: 'start', repeat: 1, speed: 1, after: 'wait' },
    ]),
  ];
}

function buildOverflowCustomModes(): StudyMode[] {
  const modes: StudyMode[] = [];
  const overflowTitle = `${'A'.repeat(60)}🎌${'あ'.repeat(30)}${'中'.repeat(20)}`;
  const overflowDesc = `${'word'.repeat(40)}日本語🎌😀`;

  for (let i = 0; i < 60; i += 1) {
    let title: string;
    if (i === 0) {
      title = overflowTitle;
    } else if (i === 1) {
      title = '';
    } else if (i === 2) {
      title = 'Q';
    } else if (i === 3) {
      title = OVERFLOW_MIXED;
    } else {
      title = `Custom mode ${i + 1}`;
    }

    const steps: StudyMode['steps'] = i % 3 === 0
      ? [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }]
      : [
          { subtitle: 'native', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
          { subtitle: 'target', pause: 'end', repeat: 1, speed: 1, after: 'continue' },
        ];

    const mode = makeCustomMode(`custom-overflow-${i + 1}`, title, steps);
    if (i === 4) {
      mode.description = overflowDesc;
    }
    modes.push(mode);
  }
  return modes;
}

export function getMockStudyModeState(variant: DataVariant = SHOWCASE_DATA): StudyModeState {
  const customModes = variant === 'empty' ? [] : variant === 'overflow' ? buildOverflowCustomModes() : buildFullCustomModes();
  return {
    version: 1,
    activeModeId: customModes[0]?.id ?? 'normal',
    customModes,
    advanced: { skipNoDialogue: 'OFF', removeBracketed: false },
  };
}

const OVERFLOW_QUEUE_TERM = `${'A'.repeat(120)}🎌${'あ'.repeat(60)}${'中'.repeat(50)}`;
const OVERFLOW_QUEUE_DEFINITION = `${'definition'.repeat(30)}日本語🎌😀`;

function buildFullQueue(): CardCreatorQueueItem[] {
  return [
    { term: 'serendipity', definitions: 'the occurrence of events by chance in a happy or beneficial way', status: 'unknown' },
    { term: 'ephemeral', definitions: 'lasting for a very short time', status: 'tracking' },
    { term: 'luminous', definitions: 'full of or shedding light; bright or shining', status: 'unknown' },
  ];
}

function buildOverflowQueue(): CardCreatorQueueItem[] {
  const items: CardCreatorQueueItem[] = [];
  for (let i = 0; i < 50; i += 1) {
    let term: string;
    let definitions: string;
    if (i === 0) {
      term = OVERFLOW_QUEUE_TERM;
      definitions = OVERFLOW_QUEUE_DEFINITION;
    } else if (i === 1) {
      term = '';
      definitions = OVERFLOW_MIXED;
    } else if (i === 2) {
      term = 'Z';
      definitions = '';
    } else if (i === 3) {
      term = OVERFLOW_MIXED;
      definitions = 'single';
    } else {
      term = `overflow-term-${i + 1}`;
      definitions = `Overflow definition for queue item number ${i + 1}.`;
    }
    items.push({ term, definitions, status: i % 3 === 0 ? 'unknown' : 'tracking' });
  }
  return items;
}

export function getMockCardCreatorQueue(variant: DataVariant = SHOWCASE_DATA): CardCreatorQueueItem[] {
  switch (variant) {
    case 'empty':
      return [];
    case 'overflow':
      return buildOverflowQueue();
    case 'full':
    default:
      return buildFullQueue();
  }
}

interface SearchResultItem {
  readonly id: string;
  readonly title: string;
  readonly language: string;
}

function buildFullSearchResults(): SearchResultItem[] {
  return [
    { id: '1', title: 'The Witcher - S01E01', language: 'en' },
    { id: '2', title: 'Crash Landing on You - E03', language: 'ja' },
    { id: '3', title: 'Squid Game - S01E02', language: 'en' },
    { id: '4', title: 'Demon Slayer - Mugen Train', language: 'ja' },
  ];
}

function buildOverflowSearchResults(): SearchResultItem[] {
  const results: SearchResultItem[] = [];
  const languages = ['en', 'ja', 'ko', 'zh'];
  const overflowTitle = `${'A'.repeat(80)}日本語🎌😀`;
  for (let i = 0; i < 120; i += 1) {
    let title: string;
    if (i === 0) {
      title = overflowTitle;
    } else if (i === 1) {
      title = '';
    } else if (i === 2) {
      title = 'X';
    } else if (i === 3) {
      title = '日本語🎌TiếngViệt';
    } else if (i % 5 === 0) {
      title = `${'show'.repeat(50)}`;
    } else {
      title = `Result ${i + 1} — long tail search match for overflow testing`;
    }
    results.push({ id: `r-${i + 1}`, title, language: languages[i % languages.length] ?? 'en' });
  }
  return results;
}

export function getMockSearchResults(variant: DataVariant = SHOWCASE_DATA): SearchResultItem[] {
  switch (variant) {
    case 'empty':
      return [];
    case 'overflow':
      return buildOverflowSearchResults();
    case 'full':
    default:
      return buildFullSearchResults();
  }
}
