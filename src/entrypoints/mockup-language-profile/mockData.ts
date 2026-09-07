import { OVERLAY_LANGUAGE_OPTIONS, isoCodeToLabel } from '@/shared/config/languageRegistry';

/** Mock profile shape for the redesign concepts (visual mockup, not the real entity). */
export interface MockProfile {
  readonly id: string;
  readonly target: string;
  /** '' = inherit universal native */
  readonly native: string;
  readonly name: string;
  /** fake summary data to show what a profile carries */
  readonly subtitleOverlay: { autoLoad: boolean; asr: boolean; autoTranslate: boolean };
  readonly dictPopup: { enabled: boolean; trigger: string };
  readonly resources: number;
}

export const MOCK_UNIVERSAL_NATIVE = 'vi';

export const MOCK_PROFILES: MockProfile[] = [
  {
    id: 'p-en',
    target: 'en',
    native: '',
    name: 'Tiếng Việt → English',
    subtitleOverlay: { autoLoad: true, asr: true, autoTranslate: true },
    dictPopup: { enabled: true, trigger: 'click' },
    resources: 2,
  },
  {
    id: 'p-ja',
    target: 'ja',
    native: '',
    name: 'Tiếng Việt → Japanese',
    subtitleOverlay: { autoLoad: true, asr: false, autoTranslate: true },
    dictPopup: { enabled: true, trigger: 'hover' },
    resources: 1,
  },
  {
    id: 'p-ko',
    target: 'ko',
    native: 'en',
    name: 'English → Korean',
    subtitleOverlay: { autoLoad: false, asr: false, autoTranslate: false },
    dictPopup: { enabled: false, trigger: 'click' },
    resources: 0,
  },
];

export function langLabel(code: string): string {
  if (!code) return 'None';
  const opt = OVERLAY_LANGUAGE_OPTIONS.find((o) => o.value === code);
  return opt?.label ?? isoCodeToLabel(code) ?? code;
}

/** Short display name — drops the "(English)" gloss, e.g. "Tiếng Việt". */
export function langShort(code: string): string {
  return langLabel(code).split(' (')[0];
}

export function resolvedNative(p: MockProfile, universal: string): string {
  return p.native || universal;
}
