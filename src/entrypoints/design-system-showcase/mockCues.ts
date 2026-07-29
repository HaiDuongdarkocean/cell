import type { SrtCue } from '@/entities/media/types';

export const mockTargetCues: SrtCue[] = [
  { index: 1, start: 0, end: 3000, text: 'Hello, welcome to the show.' },
  { index: 2, start: 3200, end: 6000, text: 'Today we are learning languages.' },
  { index: 3, start: 6200, end: 9000, text: 'Please repeat after me.' },
];

export const mockNativeCues: SrtCue[] = [
  { index: 1, start: 0, end: 3000, text: 'Xin chào, chào mừng đến chương trình.' },
  { index: 2, start: 3200, end: 6000, text: 'Hôm nay chúng ta học ngôn ngữ.' },
  { index: 3, start: 6200, end: 9000, text: 'Hãy nhắc lại sau tôi.' },
];
