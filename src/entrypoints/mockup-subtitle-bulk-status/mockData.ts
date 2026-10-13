import type { BilingualCue } from '@/entities/media';
import type { WordStatus } from '@/entities/dictionary';
import type { TokenFrequencyBand } from '@/shared/lib/frequencyBand';

export const MOCK_CUES: BilingualCue[] = [
  {
    index: 0,
    start: 1000,
    end: 3500,
    targetText: 'I have been waiting for this moment all my life',
    nativeText: 'Tôi đã chờ đợi khoảnh khắc này cả đời',
  },
  {
    index: 1,
    start: 3600,
    end: 6200,
    targetText: 'The river carries everything downstream without asking',
    nativeText: 'Dòng sông cuốn tất cả xuôi dòng không hỏi',
  },
  {
    index: 2,
    start: 6300,
    end: 8900,
    targetText: 'She opened the window and let the morning air in',
    nativeText: 'Cô ấy mở cửa sổ và đón không khí buổi sáng vào',
  },
  {
    index: 3,
    start: 9000,
    end: 12400,
    targetText: 'Every word you learn becomes a small stone in your pocket',
    nativeText: 'Mỗi từ bạn học trở thành một viên sỏi nhỏ trong túi',
  },
];

const STATUS_BY_WORD: Record<string, WordStatus> = {
  waiting: 'tracking',
  moment: 'tracking',
  river: 'known',
  carries: 'unknown',
  downstream: 'unknown',
  opened: 'known',
  window: 'known',
  morning: 'tracking',
  learn: 'unknown',
  stone: 'tracking',
  pocket: 'unknown',
};

const BAND_BY_WORD: Record<string, TokenFrequencyBand> = {
  waiting: 'common',
  moment: 'common',
  river: 'core',
  carries: 'general',
  downstream: 'rare',
  window: 'core',
  morning: 'common',
  learn: 'core',
  stone: 'general',
  pocket: 'rare',
};

export function statusFor(word: string): WordStatus {
  return STATUS_BY_WORD[word.toLowerCase()] ?? 'known';
}

export function bandFor(word: string): TokenFrequencyBand | null {
  return BAND_BY_WORD[word.toLowerCase()] ?? null;
}

export interface MatrixTihoka {
  label: string;
  status: WordStatus;
  band: TokenFrequencyBand | null;
}

export const MATRIX: MatrixTihoka[] = [
  { label: 'unknown', status: 'unknown', band: null },
  { label: 'tracking', status: 'tracking', band: null },
  { label: 'known', status: 'known', band: null },
  { label: 'ignore', status: 'ignore', band: null },
  { label: 'freq·core', status: 'known', band: 'core' },
  { label: 'freq·common', status: 'tracking', band: 'common' },
  { label: 'freq·general', status: 'unknown', band: 'general' },
  { label: 'freq·advanced', status: 'unknown', band: 'advanced' },
  { label: 'freq·rare', status: 'tracking', band: 'rare' },
  { label: 'status+freq', status: 'tracking', band: 'core' },
];
