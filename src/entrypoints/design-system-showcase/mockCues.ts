import type { SrtCue } from '@/entities/media/types';
import type { BilingualCue } from '@/entities/media';
import { SHOWCASE_DATA, type DataVariant } from './showcaseParams';

const FULL_TARGET_CUES: SrtCue[] = [
  { index: 1, start: 0, end: 3000, text: 'Hello, welcome to the show.' },
  { index: 2, start: 3200, end: 6000, text: 'Today we are learning languages.' },
  { index: 3, start: 6200, end: 9000, text: 'Please repeat after me.' },
];

const FULL_NATIVE_CUES: SrtCue[] = [
  { index: 1, start: 0, end: 3000, text: 'Xin chào, chào mừng đến chương trình.' },
  { index: 2, start: 3200, end: 6000, text: 'Hôm nay chúng ta học ngôn ngữ.' },
  { index: 3, start: 6200, end: 9000, text: 'Hãy nhắc lại sau tôi.' },
];

const OVERFLOW_CUE_COUNT = 120;
const OVERFLOW_CUE_DURATION = 1500;

const OVERFLOW_UNBROKEN = `${'A'.repeat(120)}${'🎌'.repeat(30)}${'あ'.repeat(60)}${'中'.repeat(50)}`;
const OVERFLOW_MIXED = '日本語🎌😀TiếngViệtEnglish한국어中文';

function buildOverflowCues(): { target: SrtCue[]; native: SrtCue[] } {
  const target: SrtCue[] = [];
  const native: SrtCue[] = [];

  for (let i = 0; i < OVERFLOW_CUE_COUNT; i += 1) {
    const start = i * OVERFLOW_CUE_DURATION;
    const end = start + OVERFLOW_CUE_DURATION - 100;
    const index = i + 1;

    let targetText: string;
    let nativeText: string;

    if (i === 0) {
      targetText = OVERFLOW_UNBROKEN;
      nativeText = OVERFLOW_UNBROKEN;
    } else if (i === 1) {
      targetText = '';
      nativeText = OVERFLOW_MIXED;
    } else if (i === 2) {
      targetText = 'X';
      nativeText = '';
    } else if (i === 3) {
      targetText = OVERFLOW_MIXED;
      nativeText = 'a';
    } else if (i % 7 === 0) {
      targetText = `${'word'.repeat(50)}`;
      nativeText = `${'từ'.repeat(50)}`;
    } else if (i % 5 === 0) {
      targetText = '';
      nativeText = '';
    } else {
      targetText = `Cue number ${index} with a regular sentence for overflow testing.`;
      nativeText = `Câu số ${index} với một câu thông thường để kiểm tra tràn.`;
    }

    target.push({ index, start, end, text: targetText });
    native.push({ index, start, end, text: nativeText });
  }

  return { target, native };
}

function getCuesForVariant(variant: DataVariant): { targetCues: SrtCue[]; nativeCues: SrtCue[] } {
  switch (variant) {
    case 'empty':
      return { targetCues: [], nativeCues: [] };
    case 'overflow': {
      const { target, native } = buildOverflowCues();
      return { targetCues: target, nativeCues: native };
    }
    case 'full':
    default:
      return { targetCues: FULL_TARGET_CUES, nativeCues: FULL_NATIVE_CUES };
  }
}

function getBilingualCuesForVariant(variant: DataVariant): BilingualCue[] {
  const { targetCues, nativeCues } = getCuesForVariant(variant);
  return targetCues.map((t, i) => ({
    index: t.index,
    start: t.start,
    end: t.end,
    targetText: t.text,
    nativeText: nativeCues[i]?.text ?? '',
  }));
}

export function getMockCues(variant: DataVariant = SHOWCASE_DATA): { targetCues: SrtCue[]; nativeCues: SrtCue[] } {
  return getCuesForVariant(variant);
}

export function getMockBilingualCues(variant: DataVariant = SHOWCASE_DATA): BilingualCue[] {
  return getBilingualCuesForVariant(variant);
}

export function getMockCueActiveIndex(variant: DataVariant = SHOWCASE_DATA): number {
  if (variant === 'empty') return -1;
  if (variant === 'overflow') return 49;
  return 1;
}

const { targetCues, nativeCues } = getCuesForVariant(SHOWCASE_DATA);

/**
 * Module-level cue snapshots that reflect the current `data` URL parameter.
 * Pages that read these at module load (e.g. PlayerModeOverlayPage,
 * SidePanelPage) will get the correct variant without needing a hook.
 */
export const mockTargetCues: SrtCue[] = targetCues;
export const mockNativeCues: SrtCue[] = nativeCues;
