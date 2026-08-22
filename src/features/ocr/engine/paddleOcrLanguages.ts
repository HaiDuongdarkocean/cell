// paddleOcrLanguages — SSOT cho PP-OCRv5 multilingual (spec ocr-split-dual-stream, ADR-082).
// 12 recognition models (default 'ch' + 11 multilingual), 108 languages.
// Verified 2026-08-22 against PaddleOCR docs: japan/chinese_cht map về default model.
// Note: docs prose claim "106 languages" but their own abbreviation table lists 109
// unique entries (spec drops 'ang' Old English → 108). Data table wins over prose.

export interface PaddleOcrLangEntry { readonly abbr: string; readonly label: string; }
export interface PaddleOcrModelGroup {
  readonly model: string;
  readonly languages: readonly PaddleOcrLangEntry[];
}

/** 12 recognition models covering 108 languages (default + 11 multilingual).
 *  Note: 'ku' (Kurdish) appears in both latin & arabic lists in PaddleOCR docs;
 *  'ru/be/uk' in both eslav & cyrillic — we list each abbr exactly ONCE
 *  (eslav preferred for ru/be/uk: smaller model, same accuracy per docs).
 *  Source: PaddleOCR docs §4-5 (verified 2026-08-22). */
export const PADDLE_OCR_LANGUAGE_GROUPS = [
  { model: 'ch', languages: [
    { abbr: 'ch', label: 'Chinese & English' },
    { abbr: 'japan', label: 'Japanese' },
    { abbr: 'chinese_cht', label: 'Traditional Chinese' },
  ]},
  { model: 'en', languages: [
    { abbr: 'en', label: 'English (optimized)' },
  ]},
  { model: 'korean', languages: [
    { abbr: 'korean', label: 'Korean' },
  ]},
  { model: 'latin', languages: [
    { abbr: 'fr', label: 'French' }, { abbr: 'de', label: 'German' },
    { abbr: 'af', label: 'Afrikaans' }, { abbr: 'it', label: 'Italian' },
    { abbr: 'es', label: 'Spanish' }, { abbr: 'bs', label: 'Bosnian' },
    { abbr: 'pt', label: 'Portuguese' }, { abbr: 'cs', label: 'Czech' },
    { abbr: 'cy', label: 'Welsh' }, { abbr: 'da', label: 'Danish' },
    { abbr: 'et', label: 'Estonian' }, { abbr: 'ga', label: 'Irish' },
    { abbr: 'hr', label: 'Croatian' }, { abbr: 'uz', label: 'Uzbek' },
    { abbr: 'hu', label: 'Hungarian' }, { abbr: 'rs_latin', label: 'Serbian (Latin)' },
    { abbr: 'id', label: 'Indonesian' }, { abbr: 'oc', label: 'Occitan' },
    { abbr: 'is', label: 'Icelandic' }, { abbr: 'lt', label: 'Lithuanian' },
    { abbr: 'mi', label: 'Maori' }, { abbr: 'ms', label: 'Malay' },
    { abbr: 'nl', label: 'Dutch' }, { abbr: 'no', label: 'Norwegian' },
    { abbr: 'pl', label: 'Polish' }, { abbr: 'sk', label: 'Slovak' },
    { abbr: 'sl', label: 'Slovenian' }, { abbr: 'sq', label: 'Albanian' },
    { abbr: 'sv', label: 'Swedish' }, { abbr: 'sw', label: 'Swahili' },
    { abbr: 'tl', label: 'Tagalog' }, { abbr: 'tr', label: 'Turkish' },
    { abbr: 'la', label: 'Latin' }, { abbr: 'az', label: 'Azerbaijani' },
    { abbr: 'ku', label: 'Kurdish' }, { abbr: 'lv', label: 'Latvian' },
    { abbr: 'mt', label: 'Maltese' }, { abbr: 'pi', label: 'Pali' },
    { abbr: 'ro', label: 'Romanian' }, { abbr: 'vi', label: 'Vietnamese' },
    { abbr: 'fi', label: 'Finnish' }, { abbr: 'eu', label: 'Basque' },
    { abbr: 'gl', label: 'Galician' }, { abbr: 'lb', label: 'Luxembourgish' },
    { abbr: 'rm', label: 'Romansh' }, { abbr: 'ca', label: 'Catalan' },
    { abbr: 'qu', label: 'Quechua' },
  ]},
  { model: 'eslav', languages: [
    { abbr: 'ru', label: 'Russian' }, { abbr: 'be', label: 'Belarusian' },
    { abbr: 'uk', label: 'Ukrainian' },
  ]},
  { model: 'cyrillic', languages: [
    { abbr: 'rs_cyrillic', label: 'Serbian (Cyrillic)' }, { abbr: 'bg', label: 'Bulgarian' },
    { abbr: 'mn', label: 'Mongolian' }, { abbr: 'ab', label: 'Abkhaz' },
    { abbr: 'ady', label: 'Adyghe' }, { abbr: 'kbd', label: 'Kabardian' },
    { abbr: 'av', label: 'Avar' }, { abbr: 'dar', label: 'Dargwa' },
    { abbr: 'inh', label: 'Ingush' }, { abbr: 'ce', label: 'Chechen' },
    { abbr: 'lki', label: 'Lak' }, { abbr: 'lez', label: 'Lezgian' },
    { abbr: 'tab', label: 'Tabasaran' }, { abbr: 'kk', label: 'Kazakh' },
    { abbr: 'ky', label: 'Kyrgyz' }, { abbr: 'tg', label: 'Tajik' },
    { abbr: 'mk', label: 'Macedonian' }, { abbr: 'tt', label: 'Tatar' },
    { abbr: 'cv', label: 'Chuvash' }, { abbr: 'ba', label: 'Bashkir' },
    { abbr: 'mhr', label: 'Mari' }, { abbr: 'mo', label: 'Moldovan' },
    { abbr: 'udm', label: 'Udmurt' }, { abbr: 'kv', label: 'Komi' },
    { abbr: 'os', label: 'Ossetian' }, { abbr: 'bua', label: 'Buriat' },
    { abbr: 'xal', label: 'Kalmyk' }, { abbr: 'tyv', label: 'Tuvinian' },
    { abbr: 'sah', label: 'Sakha' }, { abbr: 'kaa', label: 'Karakalpak' },
  ]},
  { model: 'th', languages: [{ abbr: 'th', label: 'Thai' }] },
  { model: 'el', languages: [{ abbr: 'el', label: 'Greek' }] },
  { model: 'arabic', languages: [
    { abbr: 'ar', label: 'Arabic' }, { abbr: 'fa', label: 'Persian' },
    { abbr: 'ug', label: 'Uyghur' }, { abbr: 'ur', label: 'Urdu' },
    { abbr: 'ps', label: 'Pashto' }, { abbr: 'sd', label: 'Sindhi' },
    { abbr: 'bal', label: 'Balochi' },
  ]},
  { model: 'devanagari', languages: [
    { abbr: 'hi', label: 'Hindi' }, { abbr: 'mr', label: 'Marathi' },
    { abbr: 'ne', label: 'Nepali' }, { abbr: 'bh', label: 'Bihari' },
    { abbr: 'mai', label: 'Maithili' }, { abbr: 'bho', label: 'Bhojpuri' },
    { abbr: 'mah', label: 'Magahi' }, { abbr: 'sck', label: 'Sadri' },
    { abbr: 'new', label: 'Newar' }, { abbr: 'gom', label: 'Konkani' },
    { abbr: 'sa', label: 'Sanskrit' }, { abbr: 'bgc', label: 'Haryanvi' },
  ]},
  { model: 'ta', languages: [{ abbr: 'ta', label: 'Tamil' }] },
  { model: 'te', languages: [{ abbr: 'te', label: 'Telugu' }] },
] as const satisfies readonly PaddleOcrModelGroup[];

/** Derive từ catalog — typo fail compile (spec: không dùng `'auto' | string`). */
export type PaddleLangAbbr = (typeof PADDLE_OCR_LANGUAGE_GROUPS)[number]['languages'][number]['abbr'];
export type ResolvedOcrLang = 'auto' | PaddleLangAbbr;

/** abbr → model name (engineKey). O(1) Map lookup. */
const ABBR_TO_MODEL: ReadonlyMap<string, string> = new Map(
  PADDLE_OCR_LANGUAGE_GROUPS.flatMap((g) => g.languages.map((l) => [l.abbr, g.model] as const)),
);

/** ISO 639-1 → PaddleOCR abbr. Chỉ chứa ISO codes có trong catalog; phần còn lại → 'auto'.
 *  Identity entries (fr→fr...) = abbr trùng tên ISO. zh/ja/ko là 3 abbr khác tên ISO.
 *  Abbr không có ISO 639-1 chuẩn (rs_latin, rs_cyrillic, ady, kbd, dar, inh, lki, lez,
 *  tab, mhr, mo, udm, bua, xal, tyv, sah, kaa, bal, bh, mai, bho, mah, sck, new, gom,
 *  bgc, chinese_cht, japan, korean...) bị bỏ qua — system lang không resolve tới chúng,
 *  vẫn chọn được qua override. */
export const ISO_TO_PADDLE: Readonly<Record<string, string>> = {
  zh: 'ch', en: 'en', ja: 'japan', ko: 'korean',
  vi: 'vi', fr: 'fr', de: 'de', es: 'es', it: 'it', pt: 'pt',
  ru: 'ru', th: 'th', ar: 'ar', hi: 'hi', tr: 'tr', nl: 'nl',
  pl: 'pl', sv: 'sv', da: 'da', fi: 'fi', cs: 'cs', sk: 'sk',
  hu: 'hu', ro: 'ro', bg: 'bg', uk: 'uk', el: 'el', ms: 'ms',
  id: 'id', no: 'no', is: 'is', lt: 'lt', lv: 'lv', et: 'et',
  ga: 'ga', cy: 'cy', mt: 'mt', hr: 'hr', sl: 'sl', sq: 'sq',
  // latin còn lại: af, bs, sw, tl, uz, la, az, ku, pi, eu, gl, lb, rm, ca, qu, oc, mi
  af: 'af', bs: 'bs', sw: 'sw', tl: 'tl', uz: 'uz', la: 'la',
  az: 'az', ku: 'ku', pi: 'pi', eu: 'eu', gl: 'gl', lb: 'lb',
  rm: 'rm', ca: 'ca', qu: 'qu', oc: 'oc', mi: 'mi',
  // cyrillic/eslav: be, mn, kk, ky, tg, mk, tt, cv, ab, av, ce, ba, kv, os
  be: 'be', mn: 'mn', kk: 'kk', ky: 'ky', tg: 'tg', mk: 'mk',
  tt: 'tt', cv: 'cv', ab: 'ab', av: 'av', ce: 'ce', ba: 'ba',
  kv: 'kv', os: 'os',
  // arabic: fa, ug, ur, ps, sd — devanagari: mr, ne, sa — ta/te
  fa: 'fa', ug: 'ug', ur: 'ur', ps: 'ps', sd: 'sd',
  mr: 'mr', ne: 'ne', sa: 'sa', ta: 'ta', te: 'te',
};

/** lang (catalog abbr HOẶC ISO 639-1) → model name (engineKey). Unknown → 'ch'. */
export function ENGINE_KEY_FOR_LANG(lang: string): string {
  const abbr = ISO_TO_PADDLE[lang] ?? lang;
  return ABBR_TO_MODEL.get(abbr) ?? 'ch';
}

/** Resolve effective OCR language: override → system default (BCP-47 normalized) → 'auto'. */
export function resolveOcrLang(override: string | null, systemLang: string): ResolvedOcrLang {
  if (override) return override as ResolvedOcrLang;
  const iso = systemLang.trim().toLowerCase().split('-')[0] ?? '';
  return (ISO_TO_PADDLE[iso] ?? 'auto') as ResolvedOcrLang;
}
