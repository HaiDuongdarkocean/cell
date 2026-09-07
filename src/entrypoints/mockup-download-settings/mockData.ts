import type {
  VideoQuality,
  ConvertToMp4Mode,
  ParallelConversionMode,
  FilenameSource,
} from '@/entities/media';
import type { SelectOption } from '@/shared/ui/Select';
import type { IconCatalogKey } from '@/shared/icons';
import {
  DEFAULT_CONCURRENT_DOWNLOADS,
  DEFAULT_QUALITY,
  DEFAULT_PREFERRED_VIDEO_FORMAT,
  DEFAULT_MANUAL_WORKER_COUNT,
  DEFAULT_FILENAME_SOURCE,
  MAX_CONVERT_BYTES,
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
} from '@/shared/config/config';

export { MIN_PARALLEL_WORKERS, MAX_PARALLEL_WORKERS };

/** The Download-card subset of `Settings` (SettingsDialogContent lines ~419-509). */
export interface DownloadSettings {
  concurrentDownloads: number;
  preferredVideoFormat: 'mp4' | 'm3u8';
  defaultQuality: VideoQuality;
  convertToMp4: ConvertToMp4Mode;
  parallelConversion: ParallelConversionMode;
  manualWorkerCount: number;
  filenameSource: FilenameSource;
}

export type SettingKey = keyof DownloadSettings;

/** Shipped defaults from `src/shared/config/config.ts` (DEFAULT_SETTINGS). */
export const DEFAULT_DOWNLOAD_SETTINGS: DownloadSettings = {
  concurrentDownloads: DEFAULT_CONCURRENT_DOWNLOADS,
  preferredVideoFormat: DEFAULT_PREFERRED_VIDEO_FORMAT,
  defaultQuality: DEFAULT_QUALITY,
  convertToMp4: 'always',
  parallelConversion: 'auto',
  manualWorkerCount: DEFAULT_MANUAL_WORKER_COUNT,
  filenameSource: DEFAULT_FILENAME_SOURCE,
};

// === Option lists — mirror SettingsDialogContent.tsx lines 56-82 ===

export const CONCURRENT_OPTIONS: readonly number[] = [1, 2, 3, 5, 10];

export const PREFERRED_FORMAT_OPTIONS: readonly ('mp4' | 'm3u8')[] = ['m3u8', 'mp4'];
export const PREFERRED_FORMAT_LABELS: Record<'mp4' | 'm3u8', string> = {
  m3u8: 'm3u8 (HLS)',
  mp4: 'mp4 (direct)',
};

export const QUALITY_OPTIONS: readonly VideoQuality[] = [
  'highest', '1080p', '720p', '480p', '360p', 'lowest', 'auto',
];
export const QUALITY_LABELS: Record<VideoQuality, string> = {
  highest: 'Highest',
  '1080p': '1080p',
  '720p': '720p',
  '480p': '480p',
  '360p': '360p',
  lowest: 'Lowest',
  auto: 'Auto (best)',
};

export const CONVERT_OPTIONS: readonly ConvertToMp4Mode[] = ['always', 'small-only', 'never'];
export const CONVERT_LABELS: Record<ConvertToMp4Mode, string> = {
  always: 'Always',
  'small-only': `Small only (≤${Math.round(MAX_CONVERT_BYTES / 1024 / 1024)}MB)`,
  never: 'Never',
};

export const PARALLEL_OPTIONS: readonly ParallelConversionMode[] = ['off', 'auto', 'manual'];
export const PARALLEL_LABELS: Record<ParallelConversionMode, string> = {
  off: 'Off',
  auto: 'Auto',
  manual: 'Manual',
};

export const WORKER_OPTIONS: readonly number[] = [2, 3, 4, 5, 6];

export const FILENAME_SOURCE_OPTIONS: readonly FilenameSource[] = [
  'title-fallback', 'title-only', 'url-only',
];
export const FILENAME_SOURCE_LABELS: Record<FilenameSource, string> = {
  'title-fallback': 'Title (fallback URL)',
  'title-only': 'Title only',
  'url-only': 'URL only',
};

// === Field metadata shared by every concept ===

const numOptions = (values: readonly number[]): SelectOption[] =>
  values.map((n) => ({ value: String(n), label: String(n) }));

const enumOptions = <T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): SelectOption[] => values.map((v) => ({ value: v, label: labels[v] }));

export interface FieldDef {
  readonly key: SettingKey;
  /** Full label used next to / above the select. */
  readonly label: string;
  /** Short label for dense contexts (summary chips, tile headers). */
  readonly shortLabel: string;
  readonly options: SelectOption[];
  /** Optional hint factory — mirrors the production HintIcon copy. */
  readonly hint?: (s: DownloadSettings) => string;
}

export const FIELD_DEFS: Record<SettingKey, FieldDef> = {
  concurrentDownloads: {
    key: 'concurrentDownloads',
    label: 'Downloads at once',
    shortLabel: 'At once',
    options: numOptions(CONCURRENT_OPTIONS),
  },
  preferredVideoFormat: {
    key: 'preferredVideoFormat',
    label: 'Preferred format',
    shortLabel: 'Format',
    options: enumOptions(PREFERRED_FORMAT_OPTIONS, PREFERRED_FORMAT_LABELS),
  },
  defaultQuality: {
    key: 'defaultQuality',
    label: 'Default quality',
    shortLabel: 'Quality',
    options: enumOptions(QUALITY_OPTIONS, QUALITY_LABELS),
  },
  convertToMp4: {
    key: 'convertToMp4',
    label: 'Convert to MP4',
    shortLabel: 'MP4',
    options: enumOptions(CONVERT_OPTIONS, CONVERT_LABELS),
  },
  parallelConversion: {
    key: 'parallelConversion',
    label: 'Parallel conversion',
    shortLabel: 'Parallel',
    options: enumOptions(PARALLEL_OPTIONS, PARALLEL_LABELS),
    hint: (s) =>
      `Parallel conversion: ${s.parallelConversion} (worker count depends on your computer's GPU)`,
  },
  manualWorkerCount: {
    key: 'manualWorkerCount',
    label: 'Workers',
    shortLabel: 'Workers',
    options: numOptions(WORKER_OPTIONS),
  },
  filenameSource: {
    key: 'filenameSource',
    label: 'Filename source',
    shortLabel: 'Filename',
    options: enumOptions(FILENAME_SOURCE_OPTIONS, FILENAME_SOURCE_LABELS),
  },
};

/** Setting groups — same grouping + order as the shipped Download card. */
export interface GroupDef {
  readonly id: 'concurrency' | 'format' | 'conversion' | 'filename';
  readonly label: string;
  readonly fields: readonly SettingKey[];
}

export const SETTING_GROUPS: readonly GroupDef[] = [
  { id: 'concurrency', label: 'Concurrency', fields: ['concurrentDownloads'] },
  { id: 'format', label: 'Format & Quality', fields: ['preferredVideoFormat', 'defaultQuality'] },
  {
    id: 'conversion',
    label: 'Conversion',
    fields: ['convertToMp4', 'parallelConversion', 'manualWorkerCount'],
  },
  { id: 'filename', label: 'Filename', fields: ['filenameSource'] },
];

/** Fields rendered inside the sticky summary bar in Concept C. */
export const SUMMARY_FIELDS: readonly SettingKey[] = [
  'concurrentDownloads',
  'preferredVideoFormat',
  'defaultQuality',
  'convertToMp4',
  'parallelConversion',
  'filenameSource',
];

/** Nature-tinted accents for Concept B tiles (token-driven in CSS). */
export type TileAccent = 'sky' | 'leaf' | 'sun' | 'stone';

export interface TileDef {
  readonly key: SettingKey;
  readonly icon: IconCatalogKey;
  readonly accent: TileAccent;
  readonly blurb: string;
}

export const TILE_DEFS: readonly TileDef[] = [
  {
    key: 'concurrentDownloads',
    icon: 'download',
    accent: 'sky',
    blurb: 'How many downloads run at once.',
  },
  {
    key: 'preferredVideoFormat',
    icon: 'fileVideo',
    accent: 'sky',
    blurb: 'Container picked for new downloads.',
  },
  {
    key: 'defaultQuality',
    icon: 'gauge',
    accent: 'sun',
    blurb: 'Resolution picked when several exist.',
  },
  {
    key: 'convertToMp4',
    icon: 'repeat',
    accent: 'leaf',
    blurb: 'TS → MP4 transmux after download.',
  },
  {
    key: 'parallelConversion',
    icon: 'layers',
    accent: 'stone',
    blurb: 'Split conversion across workers.',
  },
  {
    key: 'filenameSource',
    icon: 'pencil',
    accent: 'stone',
    blurb: 'Where saved file names come from.',
  },
];

/** Apply a raw select value to a setting, converting numbers + clamping workers. */
export function applyValue(
  s: DownloadSettings,
  key: SettingKey,
  raw: string,
): DownloadSettings {
  switch (key) {
    case 'concurrentDownloads':
      return { ...s, concurrentDownloads: Number(raw) };
    case 'manualWorkerCount':
      return {
        ...s,
        manualWorkerCount: Math.max(
          MIN_PARALLEL_WORKERS,
          Math.min(MAX_PARALLEL_WORKERS, Number(raw)),
        ),
      };
    case 'preferredVideoFormat':
      return { ...s, preferredVideoFormat: raw as 'mp4' | 'm3u8' };
    case 'defaultQuality':
      return { ...s, defaultQuality: raw as VideoQuality };
    case 'convertToMp4':
      return { ...s, convertToMp4: raw as ConvertToMp4Mode };
    case 'parallelConversion':
      return { ...s, parallelConversion: raw as ParallelConversionMode };
    case 'filenameSource':
      return { ...s, filenameSource: raw as FilenameSource };
  }
}

/** Workers only appears when parallel conversion is Manual (mirrors production). */
export function isFieldVisible(key: SettingKey, s: DownloadSettings): boolean {
  if (key === 'manualWorkerCount') return s.parallelConversion === 'manual';
  return true;
}

/** Human-readable label of a field's current value (for tiles / summaries). */
export function fieldValueLabel(key: SettingKey, s: DownloadSettings): string {
  const opt = FIELD_DEFS[key].options.find((o) => o.value === String(s[key]));
  const label = opt?.label;
  return typeof label === 'string' ? label : String(s[key]);
}

/** Summary label that surfaces the worker count when parallel is manual. */
export function summaryValueLabel(key: SettingKey, s: DownloadSettings): string {
  if (key === 'parallelConversion' && s.parallelConversion === 'manual') {
    return `${fieldValueLabel(key, s)} (${s.manualWorkerCount} workers)`;
  }
  return fieldValueLabel(key, s);
}
