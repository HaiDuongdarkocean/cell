import type { SubtitlePanelItem } from '@/features/subtitle/ui/subtitlePanelModel';

export type Locale = 'en' | 'vi';
export type Scenario = 'default' | 'empty' | 'many';
export type AutoChain = 'on' | 'off' | 'chain';

export const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Subtitle Manager',
    target: 'TARGET',
    native: 'NATIVE',
    off: 'Off',
    latency: 'Latency',
    saved: 'Saved',
    saving: 'Saving…',
    autoTitle: 'Auto-load',
    autoLoad: 'Auto-load subtitles',
    autoLoadHint: 'Loads detected subtitles in your target language when a video plays.',
    autoLoadAsr: 'Include YouTube auto captions',
    autoTranslate: 'Translate when native is missing',
    autoTranslateHint: 'Falls back to Google Translate when no native-language track exists — free, no key.',
    cueDisplay: 'Cue display',
    cueList: 'List',
    cueActive: 'Active cue only',
    generate: 'Generate native',
    search: 'Search',
    ocr: 'OCR',
    customize: 'Customize',
    hide: 'Hide',
    show: 'Show',
    tagAuto: 'AUTO',
    srcImported: 'Imported',
    srcSearched: 'Searched',
    srcTranslated: 'Translated',
  },
  vi: {
    title: 'Quản lý phụ đề',
    target: 'ĐÍCH',
    native: 'BẢN ĐỊA',
    off: 'Tắt',
    latency: 'Độ trễ',
    saved: 'Đã lưu',
    saving: 'Đang lưu…',
    autoTitle: 'Tự động tải',
    autoLoad: 'Tự tải phụ đề',
    autoLoadHint: 'Tự tải phụ đề ngôn ngữ đích phát hiện được khi mở video.',
    autoLoadAsr: 'Cả phụ đề tự động của YouTube',
    autoTranslate: 'Dịch khi thiếu phụ đề bản địa',
    autoTranslateHint: 'Dùng Google Translate khi không có phụ đề bản địa — miễn phí, không cần key.',
    cueDisplay: 'Hiển thị câu',
    cueList: 'Danh sách',
    cueActive: 'Chỉ câu đang phát',
    generate: 'Tạo phụ đề bản địa',
    search: 'Tìm kiếm',
    ocr: 'OCR',
    customize: 'Tùy chỉnh',
    hide: 'Ẩn',
    show: 'Hiện',
    tagAuto: 'TỰ ĐỘNG',
    srcImported: 'Đã nhập',
    srcSearched: 'Đã tìm',
    srcTranslated: 'Đã dịch',
  },
};

const makeItem = (
  role: 'target' | 'native',
  index: number,
  name: string,
  format: string,
  source: SubtitlePanelItem['source'],
  size?: number,
  isAsr?: boolean,
): SubtitlePanelItem => ({ id: `${role}-${index}`, name, format, source, role, index, size, isAsr });

export const TARGET_DEFAULT: SubtitlePanelItem[] = [
  makeItem('target', 0, 'English', 'vtt', 'auto', 48211),
  makeItem('target', 1, 'English (auto-generated)', 'vtt', 'auto', 40102, true),
  makeItem('target', 2, 'my-subtitle-final.srt', 'srt', 'imported', 96420),
];

export const NATIVE_DEFAULT: SubtitlePanelItem[] = [
  makeItem('native', 0, 'Vietnamese (translated)', 'vtt', 'translated', 51200),
];

const LONG = 'a very long subtitle track name that should truncate';
export const TARGET_MANY: SubtitlePanelItem[] = [
  ...TARGET_DEFAULT,
  makeItem('target', 3, `English ${LONG}`, 'ass', 'searched', 88123),
  makeItem('target', 4, 'English (SDH)', 'srt', 'searched', 71200),
  makeItem('target', 5, 'English [CC] lecture capture', 'vtt', 'auto', 60400, true),
  makeItem('target', 6, 'english-for-study.srt', 'srt', 'imported', 55800),
  makeItem('target', 7, 'English #8', 'vtt', 'auto', 47000),
];

export const NATIVE_MANY: SubtitlePanelItem[] = [
  ...NATIVE_DEFAULT,
  makeItem('native', 1, 'Vietnamese (auto-generated)', 'vtt', 'auto', 44000, true),
  makeItem('native', 2, 'vi-translation-downloaded.srt', 'srt', 'imported', 63300),
  makeItem('native', 3, 'Vietnamese fan sub', 'ass', 'searched', 90100),
  makeItem('native', 4, 'Tiếng Việt chuẩn', 'vtt', 'translated', 58200),
];
