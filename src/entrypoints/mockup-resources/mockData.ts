// mockData — shared mock state for the Resources redesign mockup.
//
// Mirrors ResourcesPanel's data shapes (ResourceInfo from
// src/entities/dictionary/types.ts) so concepts exercise the same behavior:
// list, import progress, error, duplicate, toggle, reorder, delete,
// frequency bands. Data/handlers only — no layout.

import { DEFAULT_BAND_THRESHOLDS, type FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import { formatRelativeTime } from '@/features/dictionary/ui/relativeTime';
import type { ImportFormat, ResourceInfo, ResourceType } from '@/entities/dictionary';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

/** 2 dictionaries + 2 frequency lists, mixed enabled/priority states. */
export const MOCK_RESOURCES: readonly ResourceInfo[] = [
  {
    id: 1,
    name: 'JMdict (English)',
    langCode: 'en',
    type: 'DICTIONARY',
    format: 'yomitan',
    signature: 'sig-jmdict-en',
    wordCount: 186420,
    installationFinished: true,
    importedAt: NOW - 2 * DAY_MS,
    enabled: true,
    priority: 0,
  },
  {
    id: 2,
    name: 'Cambridge Essential',
    langCode: 'en',
    type: 'DICTIONARY',
    format: 'cambridge-json',
    signature: 'sig-cambridge-ess',
    wordCount: 42180,
    installationFinished: true,
    importedAt: NOW - 9 * DAY_MS,
    enabled: false,
    priority: 1,
  },
  {
    id: 3,
    name: 'Top 10k Frequency',
    langCode: 'en',
    type: 'FREQUENCY',
    format: 'json-array',
    signature: 'sig-top10k',
    wordCount: 10000,
    installationFinished: true,
    importedAt: NOW - 1 * DAY_MS,
    enabled: true,
    priority: 0,
  },
  {
    id: 4,
    name: 'Netflix Subs Rank',
    langCode: 'en',
    type: 'FREQUENCY',
    format: 'txt',
    signature: 'sig-netflix-subs',
    wordCount: 26450,
    installationFinished: true,
    importedAt: NOW - 34 * DAY_MS,
    enabled: true,
    priority: 1,
  },
];

/** A pending duplicate-import decision, resolved against the live list. */
export interface MockDuplicate {
  readonly fileName: string;
  readonly existingId: number;
  readonly existingName: string;
}

/** Per-section import state — mirrors ResourcesPanel's ImportState. */
export interface MockSectionImport {
  readonly importing: boolean;
  readonly progress: number;
  readonly progressTotal: number;
  /** Name of the file currently being imported (drives finalize). */
  readonly pendingName: string | null;
  readonly error: string | null;
  readonly success: string | null;
  readonly duplicate: MockDuplicate | null;
}

export const IDLE_IMPORT: MockSectionImport = {
  importing: false,
  progress: 0,
  progressTotal: 0,
  pendingName: null,
  error: null,
  success: null,
  duplicate: null,
};

/** Seeded so every state is visible on first load: 1 error alert +
 *  1 duplicate prompt (dictionary), 1 in-flight import (frequency). */
export const INITIAL_IMPORT_STATES: Record<ResourceType, MockSectionImport> = {
  DICTIONARY: {
    ...IDLE_IMPORT,
    error: 'Không thể đọc "broken-dict.zip" — file không đúng định dạng.',
    duplicate: {
      fileName: 'jmdict-english-v2.zip',
      existingId: 1,
      existingName: 'JMdict (English)',
    },
  },
  FREQUENCY: {
    ...IDLE_IMPORT,
    importing: true,
    progress: 640,
    progressTotal: 1200,
    pendingName: 'BNC/COCA 25k',
  },
};

export const DEFAULT_MOCK_BANDS: FrequencyBandThresholds = DEFAULT_BAND_THRESHOLDS;

export interface ImportSpec {
  readonly name: string;
  readonly format: ImportFormat;
  readonly wordCount: number;
}

/** Files "added" by simulated imports — cycles per section. */
export const IMPORT_POOL: Record<ResourceType, readonly ImportSpec[]> = {
  DICTIONARY: [
    { name: 'Wiktionary Simple', format: 'yomitan', wordCount: 56210 },
    { name: 'CC-CEDICT Compact', format: 'yomitan', wordCount: 118240 },
  ],
  FREQUENCY: [
    { name: 'BNC/COCA 25k', format: 'txt', wordCount: 25000 },
    { name: 'OpenSubs Top 50k', format: 'json-array', wordCount: 50000 },
  ],
};

export interface SectionCopy {
  readonly title: string;
  readonly subtitle: string;
  readonly dropLabel: string;
  readonly dropHint: string;
  readonly empty: string;
  readonly noun: string;
}

/** Same copy as ResourcesPanel's SECTION_COPY so concepts stay comparable. */
export const SECTION_COPY: Record<ResourceType, SectionCopy> = {
  DICTIONARY: {
    title: 'Từ điển',
    subtitle: 'Tra nghĩa, phiên âm, phát âm.',
    dropLabel: 'Thêm từ điển',
    dropHint: '.json, .zip (Yomitan)',
    empty: 'Chưa có từ điển nào — thêm file để bắt đầu.',
    noun: 'từ điển',
  },
  FREQUENCY: {
    title: 'Độ phổ biến',
    subtitle: 'Đánh dấu từ hay gặp.',
    dropLabel: 'Thêm danh sách',
    dropHint: '.txt, .json, .zip, .db.gz',
    empty: 'Chưa có danh sách nào — thêm file để bắt đầu.',
    noun: 'danh sách',
  },
};

/** Frequency-band fields — same labels as FrequencyBandsEditor. */
export const BAND_FIELDS: readonly { key: keyof FrequencyBandThresholds; label: string }[] = [
  { key: 'core', label: 'Phổ biến ≤' },
  { key: 'common', label: 'Thường gặp ≤' },
  { key: 'general', label: 'Chung ≤' },
  { key: 'advanced', label: 'Nâng cao ≤' },
];

/** Terms shown when a resource card is expanded. */
export const SAMPLE_TERMS: readonly string[] = ['the', 'time', 'person', 'year', 'way', 'because'];

/** "wordCount · format · imported" meta line, matching ResourceCard. */
export function formatResourceMeta(resource: ResourceInfo): string {
  const count = resource.wordCount.toLocaleString('en-US');
  const base = `${count} từ · ${resource.format} · ${formatRelativeTime(resource.importedAt)}`;
  return resource.installationFinished ? base : `${base} · đang thêm…`;
}

/** Deterministic fake lookup rank for the expanded "Thử tra" tester. */
export function fakeRank(term: string, resource: ResourceInfo): number {
  let hash = 0;
  for (let i = 0; i < term.length; i++) {
    hash = (hash * 31 + term.charCodeAt(i)) | 0;
  }
  const bound = Math.max(resource.wordCount, 1);
  return (Math.abs(hash) % bound) + 1;
}
