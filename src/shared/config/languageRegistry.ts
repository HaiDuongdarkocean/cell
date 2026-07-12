/**
 * Single source of truth for all language data in the extension.
 *
 * Each entry: ISO 639-1 (2-letter), ISO 639-2 (3-letter, bibliographic),
 * English name, and native name. All other language maps, UI dropdown lists,
 * and matching functions are derived from this array.
 *
 * When adding a new language: add 1 entry to LANGUAGES below, everything else
 * (ISO_LANGUAGE_MAP, LABEL_TO_ISO_CODE, ISO_639_2_TO_639_1, SUBTITLE_LANGUAGES,
 * OVERLAY_LANGUAGE_OPTIONS) auto-derives.
 *
 * BCP 47 script variants (zh-hans, zh-hant) are NOT in LANGUAGES — they are
 * overlay-only options that resolve to their parent ISO 639-1 code via
 * `languageMatches()`. See OVERLAY_VARIANT_OPTIONS below.
 *
 * Source: ISO 639-1 codes (Wikipedia) + native names from UI.
 */

/** One language entry in the registry. */
export interface LanguageEntry {
  /** ISO 639-1 (2-letter) code, e.g. 'en', 'vi', 'zh'. */
  readonly iso1: string;
  /** ISO 639-2 (3-letter, bibliographic) code, e.g. 'eng', 'vie', 'zho'. Empty when none. */
  readonly iso2: string;
  /** English display name, e.g. 'English', 'Vietnamese', 'Chinese'. */
  readonly english: string;
  /** Native display name, e.g. 'English', 'Tiếng Việt', '中文'. */
  readonly native: string;
}

/**
 * The canonical language list. 182 entries covering all ISO 639-1 codes.
 * Add new languages here — all other exports derive from this array.
 */
export const LANGUAGES: readonly LanguageEntry[] = [
  { iso1: 'aa', iso2: 'aar', english: 'Afar', native: 'Afar' },
  { iso1: 'ab', iso2: 'abk', english: 'Abkhazian', native: 'Аҧсуа' },
  { iso1: 'af', iso2: 'afr', english: 'Afrikaans', native: 'Afrikaans' },
  { iso1: 'ak', iso2: 'aka', english: 'Akan', native: 'Akan' },
  { iso1: 'am', iso2: 'amh', english: 'Amharic', native: 'አማርኛ' },
  { iso1: 'ar', iso2: 'ara', english: 'Arabic', native: 'العربية' },
  { iso1: 'as', iso2: 'asm', english: 'Assamese', native: 'অসমীয়া' },
  { iso1: 'av', iso2: 'ava', english: 'Avaric', native: 'Авар' },
  { iso1: 'ay', iso2: 'aym', english: 'Aymara', native: 'Aymar aru' },
  { iso1: 'az', iso2: 'aze', english: 'Azerbaijani', native: 'Azərbaycan' },
  { iso1: 'ba', iso2: 'bak', english: 'Bashkir', native: 'Башҡорт' },
  { iso1: 'be', iso2: 'bel', english: 'Belarusian', native: 'Беларуская' },
  { iso1: 'bg', iso2: 'bul', english: 'Bulgarian', native: 'Български' },
  { iso1: 'bh', iso2: '', english: 'Bihari', native: 'भोजपुरी' },
  { iso1: 'bi', iso2: 'bis', english: 'Bislama', native: 'Bislama' },
  { iso1: 'bm', iso2: 'bam', english: 'Bambara', native: 'Bambara' },
  { iso1: 'bn', iso2: 'ben', english: 'Bengali', native: 'বাংলা' },
  { iso1: 'bo', iso2: 'bod', english: 'Tibetan', native: 'བོད་སྐད་' },
  { iso1: 'br', iso2: 'bre', english: 'Breton', native: 'Brezhoneg' },
  { iso1: 'bs', iso2: 'bos', english: 'Bosnian', native: 'Bosanski' },
  { iso1: 'ca', iso2: 'cat', english: 'Catalan', native: 'Català' },
  { iso1: 'ce', iso2: 'che', english: 'Chechen', native: 'Нохчийн' },
  { iso1: 'ch', iso2: 'cha', english: 'Chamorro', native: 'Chamoru' },
  { iso1: 'co', iso2: 'cos', english: 'Corsican', native: 'Corsu' },
  { iso1: 'cr', iso2: 'cre', english: 'Cree', native: 'ᓀᐦᐃᔭᐍᐏᐣ' },
  { iso1: 'cs', iso2: 'ces', english: 'Czech', native: 'Čeština' },
  { iso1: 'cu', iso2: 'chu', english: 'Church Slavic', native: 'Славе́нскїй' },
  { iso1: 'cv', iso2: 'chv', english: 'Chuvash', native: 'Чӑвашла' },
  { iso1: 'cy', iso2: 'cym', english: 'Welsh', native: 'Cymraeg' },
  { iso1: 'da', iso2: 'dan', english: 'Danish', native: 'Dansk' },
  { iso1: 'de', iso2: 'deu', english: 'German', native: 'Deutsch' },
  { iso1: 'dv', iso2: 'div', english: 'Dhivehi', native: 'ދިވެހި' },
  { iso1: 'dz', iso2: 'dzo', english: 'Dzongkha', native: 'རྫོང་ཁ' },
  { iso1: 'ee', iso2: 'ewe', english: 'Ewe', native: 'Eʋegbe' },
  { iso1: 'el', iso2: 'ell', english: 'Greek', native: 'Ελληνικά' },
  { iso1: 'en', iso2: 'eng', english: 'English', native: 'English' },
  { iso1: 'eo', iso2: 'epo', english: 'Esperanto', native: 'Esperanto' },
  { iso1: 'es', iso2: 'spa', english: 'Spanish', native: 'Español' },
  { iso1: 'et', iso2: 'est', english: 'Estonian', native: 'Eesti' },
  { iso1: 'eu', iso2: 'eus', english: 'Basque', native: 'Euskara' },
  { iso1: 'fa', iso2: 'fas', english: 'Persian', native: 'فارسی' },
  { iso1: 'ff', iso2: 'ful', english: 'Fulah', native: 'Fulfulde' },
  { iso1: 'fi', iso2: 'fin', english: 'Finnish', native: 'Suomi' },
  { iso1: 'fj', iso2: 'fij', english: 'Fijian', native: 'Vosa Vakaviti' },
  { iso1: 'fo', iso2: 'fao', english: 'Faroese', native: 'Føroyskt' },
  { iso1: 'fr', iso2: 'fra', english: 'French', native: 'Français' },
  { iso1: 'fy', iso2: 'fry', english: 'Western Frisian', native: 'Frysk' },
  { iso1: 'ga', iso2: 'gle', english: 'Irish', native: 'Gaeilge' },
  { iso1: 'gd', iso2: 'gla', english: 'Scottish Gaelic', native: 'Gàidhlig' },
  { iso1: 'gl', iso2: 'glg', english: 'Galician', native: 'Galego' },
  { iso1: 'gn', iso2: 'grn', english: 'Guarani', native: 'Avañeẽ' },
  { iso1: 'gu', iso2: 'guj', english: 'Gujarati', native: 'ગુજરાતી' },
  { iso1: 'gv', iso2: 'glv', english: 'Manx', native: 'Gaelg' },
  { iso1: 'ha', iso2: 'hau', english: 'Hausa', native: 'Hausa' },
  { iso1: 'he', iso2: 'heb', english: 'Hebrew', native: 'עברית' },
  { iso1: 'hi', iso2: 'hin', english: 'Hindi', native: 'हिन्दी' },
  { iso1: 'ho', iso2: 'hmo', english: 'Hiri Motu', native: 'Hiri Motu' },
  { iso1: 'hr', iso2: 'hrv', english: 'Croatian', native: 'Hrvatski' },
  { iso1: 'ht', iso2: 'hat', english: 'Haitian Creole', native: 'Kreyòl Ayisyen' },
  { iso1: 'hu', iso2: 'hun', english: 'Hungarian', native: 'Magyar' },
  { iso1: 'hy', iso2: 'hye', english: 'Armenian', native: 'Հայերեն' },
  { iso1: 'hz', iso2: 'her', english: 'Herero', native: 'Oshiwambo' },
  { iso1: 'ia', iso2: 'ina', english: 'Interlingua', native: 'Interlingua' },
  { iso1: 'id', iso2: 'ind', english: 'Indonesian', native: 'Bahasa Indonesia' },
  { iso1: 'ie', iso2: 'ile', english: 'Interlingue', native: 'Interlingue' },
  { iso1: 'ig', iso2: 'ibo', english: 'Igbo', native: 'Igbo' },
  { iso1: 'ii', iso2: 'iii', english: 'Sichuan Yi', native: 'ꆈꌠꉙ' },
  { iso1: 'ik', iso2: 'ipk', english: 'Inupiaq', native: 'Iñupiaq' },
  { iso1: 'io', iso2: 'ido', english: 'Ido', native: 'Ido' },
  { iso1: 'is', iso2: 'isl', english: 'Icelandic', native: 'Íslenska' },
  { iso1: 'it', iso2: 'ita', english: 'Italian', native: 'Italiano' },
  { iso1: 'iu', iso2: 'iku', english: 'Inuktitut', native: 'ᐃᓄᒃᑎᑐᑦ' },
  { iso1: 'ja', iso2: 'jpn', english: 'Japanese', native: '日本語' },
  { iso1: 'jv', iso2: 'jav', english: 'Javanese', native: 'Basa Jawa' },
  { iso1: 'ka', iso2: 'kat', english: 'Georgian', native: 'ქართული' },
  { iso1: 'kg', iso2: 'kon', english: 'Kongo', native: 'Kikongo' },
  { iso1: 'ki', iso2: 'kik', english: 'Kikuyu', native: 'Gĩkũyũ' },
  { iso1: 'kj', iso2: 'kua', english: 'Kwanyama', native: 'Kuanyama' },
  { iso1: 'kk', iso2: 'kaz', english: 'Kazakh', native: 'Қазақ' },
  { iso1: 'kl', iso2: 'kal', english: 'Kalaallisut', native: 'Kalaallisut (Greenlandic)' },
  { iso1: 'km', iso2: 'khm', english: 'Khmer', native: 'ខ្មែរ' },
  { iso1: 'kn', iso2: 'kan', english: 'Kannada', native: 'ಕನ್ನಡ' },
  { iso1: 'ko', iso2: 'kor', english: 'Korean', native: '한국어' },
  { iso1: 'kr', iso2: 'kau', english: 'Kanuri', native: 'Kanuri' },
  { iso1: 'ks', iso2: 'kas', english: 'Kashmiri', native: 'कश्मीरी' },
  { iso1: 'ku', iso2: 'kur', english: 'Kurdish', native: 'Kurdî' },
  { iso1: 'kv', iso2: 'kom', english: 'Komi', native: 'Коми' },
  { iso1: 'kw', iso2: 'cor', english: 'Cornish', native: 'Kernewek' },
  { iso1: 'ky', iso2: 'kir', english: 'Kyrgyz', native: 'Кыргызча' },
  { iso1: 'la', iso2: 'lat', english: 'Latin', native: 'Latina' },
  { iso1: 'lb', iso2: 'ltz', english: 'Luxembourgish', native: 'Lëtzebuergesch' },
  { iso1: 'lg', iso2: 'lug', english: 'Ganda', native: 'Luganda' },
  { iso1: 'li', iso2: 'lim', english: 'Limburgan', native: 'Limburgs' },
  { iso1: 'ln', iso2: 'lin', english: 'Lingala', native: 'Lingála' },
  { iso1: 'lo', iso2: 'lao', english: 'Lao', native: 'ລາວ' },
  { iso1: 'lt', iso2: 'lit', english: 'Lithuanian', native: 'Lietuvių' },
  { iso1: 'lu', iso2: 'lub', english: 'Luba-Katanga', native: 'Tshiluba' },
  { iso1: 'lv', iso2: 'lav', english: 'Latvian', native: 'Latviešu' },
  { iso1: 'mg', iso2: 'mlg', english: 'Malagasy', native: 'Malagasy' },
  { iso1: 'mh', iso2: 'mah', english: 'Marshallese', native: 'Kajin M̧ajeļ' },
  { iso1: 'mi', iso2: 'mri', english: 'Maori', native: 'Te Reo Māori' },
  { iso1: 'mk', iso2: 'mkd', english: 'Macedonian', native: 'Македонски' },
  { iso1: 'ml', iso2: 'mal', english: 'Malayalam', native: 'മലയാളം' },
  { iso1: 'mn', iso2: 'mon', english: 'Mongolian', native: 'Монгол' },
  { iso1: 'mr', iso2: 'mar', english: 'Marathi', native: 'मराठी' },
  { iso1: 'ms', iso2: 'msa', english: 'Malay', native: 'Bahasa Melayu' },
  { iso1: 'mt', iso2: 'mlt', english: 'Maltese', native: 'Malti' },
  { iso1: 'my', iso2: 'mya', english: 'Burmese', native: 'ဗမာ' },
  { iso1: 'na', iso2: 'nau', english: 'Nauru', native: 'Dorerin Naoero' },
  { iso1: 'nb', iso2: 'nob', english: 'Norwegian Bokmål', native: 'Norsk Bokmål' },
  { iso1: 'nd', iso2: 'nde', english: 'North Ndebele', native: 'isiNdebele' },
  { iso1: 'ne', iso2: 'nep', english: 'Nepali', native: 'नेपाली' },
  { iso1: 'ng', iso2: 'ndo', english: 'Ndonga', native: 'Owambo' },
  { iso1: 'nl', iso2: 'nld', english: 'Dutch', native: 'Nederlands' },
  { iso1: 'nn', iso2: 'nno', english: 'Norwegian Nynorsk', native: 'Norsk Nynorsk' },
  { iso1: 'no', iso2: 'nor', english: 'Norwegian', native: 'Norsk' },
  { iso1: 'nr', iso2: 'nbl', english: 'South Ndebele', native: 'isiNdebele' },
  { iso1: 'nv', iso2: 'nav', english: 'Navajo', native: 'Diné bizaad' },
  { iso1: 'ny', iso2: 'nya', english: 'Chichewa', native: 'Chichewa (Nyanja)' },
  { iso1: 'oc', iso2: 'oci', english: 'Occitan', native: 'Occitan' },
  { iso1: 'oj', iso2: 'oji', english: 'Ojibwa', native: 'ᐊᓂᔑᓈᐯᒧᐎᓐ' },
  { iso1: 'om', iso2: 'orm', english: 'Oromo', native: 'Afaan Oromoo' },
  { iso1: 'or', iso2: 'ori', english: 'Oriya', native: 'ଓଡ଼ିଆ' },
  { iso1: 'os', iso2: 'oss', english: 'Ossetian', native: 'Ирон' },
  { iso1: 'pa', iso2: 'pan', english: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { iso1: 'pi', iso2: 'pli', english: 'Pali', native: 'पालि' },
  { iso1: 'pl', iso2: 'pol', english: 'Polish', native: 'Polski' },
  { iso1: 'ps', iso2: 'pus', english: 'Pashto', native: 'پښتو' },
  { iso1: 'pt', iso2: 'por', english: 'Portuguese', native: 'Português' },
  { iso1: 'qu', iso2: 'que', english: 'Quechua', native: 'Runa Simi' },
  { iso1: 'rm', iso2: 'roh', english: 'Romansh', native: 'Rumantsch' },
  { iso1: 'rn', iso2: 'run', english: 'Kirundi', native: 'Ikirundi' },
  { iso1: 'ro', iso2: 'ron', english: 'Romanian', native: 'Română' },
  { iso1: 'ru', iso2: 'rus', english: 'Russian', native: 'Русский' },
  { iso1: 'rw', iso2: 'kin', english: 'Kinyarwanda', native: 'Kinyarwanda' },
  { iso1: 'sa', iso2: 'san', english: 'Sanskrit', native: 'संस्कृतम्' },
  { iso1: 'sc', iso2: 'srd', english: 'Sardinian', native: 'Sardu' },
  { iso1: 'sd', iso2: 'snd', english: 'Sindhi', native: 'سنڌي' },
  { iso1: 'se', iso2: 'sme', english: 'Northern Sami', native: 'Davvisámegiella' },
  { iso1: 'sg', iso2: 'sag', english: 'Sango', native: 'Sängö' },
  { iso1: 'si', iso2: 'sin', english: 'Sinhala', native: 'සිංහල' },
  { iso1: 'sk', iso2: 'slk', english: 'Slovak', native: 'Slovenčina' },
  { iso1: 'sl', iso2: 'slv', english: 'Slovenian', native: 'Slovenščina' },
  { iso1: 'sm', iso2: 'smo', english: 'Samoan', native: 'Gagana Samoa' },
  { iso1: 'sn', iso2: 'sna', english: 'Shona', native: 'ChiShona' },
  { iso1: 'so', iso2: 'som', english: 'Somali', native: 'Soomaali' },
  { iso1: 'sq', iso2: 'sqi', english: 'Albanian', native: 'Shqip' },
  { iso1: 'sr', iso2: 'srp', english: 'Serbian', native: 'Српски' },
  { iso1: 'ss', iso2: 'ssw', english: 'Swati', native: 'SiSwati' },
  { iso1: 'st', iso2: 'sot', english: 'Southern Sotho', native: 'Sesotho' },
  { iso1: 'su', iso2: 'sun', english: 'Sundanese', native: 'Basa Sunda' },
  { iso1: 'sv', iso2: 'swe', english: 'Swedish', native: 'Svenska' },
  { iso1: 'sw', iso2: 'swa', english: 'Swahili', native: 'Kiswahili' },
  { iso1: 'ta', iso2: 'tam', english: 'Tamil', native: 'தமிழ்' },
  { iso1: 'te', iso2: 'tel', english: 'Telugu', native: 'తెలుగు' },
  { iso1: 'tg', iso2: 'tgk', english: 'Tajik', native: 'Тоҷикӣ' },
  { iso1: 'th', iso2: 'tha', english: 'Thai', native: 'ไทย' },
  { iso1: 'ti', iso2: 'tir', english: 'Tigrinya', native: 'ትግርኛ' },
  { iso1: 'tk', iso2: 'tuk', english: 'Turkmen', native: 'Türkmen' },
  { iso1: 'tl', iso2: 'tgl', english: 'Tagalog', native: 'Filipino' },
  { iso1: 'tn', iso2: 'tsn', english: 'Tswana', native: 'Setswana' },
  { iso1: 'to', iso2: 'ton', english: 'Tongan', native: 'Lea Faka-Tonga (Tonga)' },
  { iso1: 'tr', iso2: 'tur', english: 'Turkish', native: 'Türkçe' },
  { iso1: 'ts', iso2: 'tso', english: 'Tsonga', native: 'Xitsonga' },
  { iso1: 'tt', iso2: 'tat', english: 'Tatar', native: 'Татар' },
  { iso1: 'tw', iso2: '', english: 'Twi', native: 'Twi' },
  { iso1: 'ty', iso2: 'tah', english: 'Tahitian', native: 'Reo Tahiti' },
  { iso1: 'ug', iso2: 'uig', english: 'Uyghur', native: 'ئۇيغۇرچە' },
  { iso1: 'uk', iso2: 'ukr', english: 'Ukrainian', native: 'Українська' },
  { iso1: 'ur', iso2: 'urd', english: 'Urdu', native: 'اردو' },
  { iso1: 'uz', iso2: 'uzb', english: 'Uzbek', native: 'Oʻzbek' },
  { iso1: 've', iso2: 'ven', english: 'Venda', native: 'Tshivenḓa' },
  { iso1: 'vi', iso2: 'vie', english: 'Vietnamese', native: 'Tiếng Việt' },
  { iso1: 'vo', iso2: 'vol', english: 'Volapük', native: 'Volapük' },
  { iso1: 'wa', iso2: 'wln', english: 'Walloon', native: 'Walon' },
  { iso1: 'wo', iso2: 'wol', english: 'Wolof', native: 'Wolof' },
  { iso1: 'xh', iso2: 'xho', english: 'Xhosa', native: 'isiXhosa' },
  { iso1: 'yi', iso2: 'yid', english: 'Yiddish', native: 'ייִדיש' },
  { iso1: 'yo', iso2: 'yor', english: 'Yoruba', native: 'Yorùbá' },
  { iso1: 'za', iso2: 'zha', english: 'Zhuang', native: 'Vahcuengh' },
  { iso1: 'zh', iso2: 'zho', english: 'Chinese', native: '中文' },
  { iso1: 'zu', iso2: 'zul', english: 'Zulu', native: 'isiZulu' },
];

// === BCP 47 script variants (overlay-only, not in LANGUAGES) ===

/**
 * BCP 47 script variants exposed as overlay target/native options alongside
 * the macrolanguage. Each variant resolves to its parent via `languageMatches()`.
 * Not part of LANGUAGES because they are not ISO 639-1 codes.
 */
export const OVERLAY_VARIANT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'zh-hans', label: '中文（简体）(Simplified Chinese)' },
  { value: 'zh-hant', label: '中文（繁體）(Traditional Chinese)' },
];

// === Derived maps (built once at module load) ===

/**
 * ISO 639-1/639-2 code -> English label. Replaces the old `ISO_LANGUAGE_MAP`.
 * Keys: both 2-letter and 3-letter codes (when iso2 is non-empty).
 */
export const ISO_LANGUAGE_MAP: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const l of LANGUAGES) {
    m.set(l.iso1, l.english);
    if (l.iso2) m.set(l.iso2, l.english);
  }
  return m;
})();

/**
 * English label (lowercase) -> ISO 639-1 (2-letter) code.
 * Replaces the old `LABEL_TO_ISO_CODE`.
 */
export const LABEL_TO_ISO_CODE: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const l of LANGUAGES) {
    m.set(l.english.toLowerCase(), l.iso1);
  }
  return m;
})();

/**
 * ISO 639-2 (3-letter) -> ISO 639-1 (2-letter) code.
 * Replaces the old `ISO_639_2_TO_639_1`.
 */
export const ISO_639_2_TO_639_1: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const l of LANGUAGES) {
    if (l.iso2) m.set(l.iso2, l.iso1);
  }
  return m;
})();

// === UI dropdown lists (derived) ===

/** Option shape used by MultiSelect + SearchableSelect. */
export interface LanguageOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Full language list for the subtitle-language MultiSelect (filter which
 * subtitle languages to download). Includes "all" as the first option.
 * Replaces the old `SUBTITLE_LANGUAGES` in SettingsDialog.tsx.
 */
export const SUBTITLE_LANGUAGES: LanguageOption[] = [
  { value: 'all', label: 'All languages' },
  ...LANGUAGES.map((l) => ({
    value: l.iso1,
    label: l.native === l.english ? l.english : `${l.native} (${l.english})`,
  })),
];

/**
 * Language options for the overlay target/native SearchableSelect dropdowns.
 * Same as SUBTITLE_LANGUAGES but without "all", with a leading "None" option
 * (value '' so users can clear the selection), plus BCP 47 script variants
 * (zh-hans, zh-hant) so users can choose Simplified or Traditional Chinese.
 * Replaces the old `OVERLAY_LANGUAGE_OPTIONS` in SettingsDialog.tsx.
 */
export const OVERLAY_LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: '', label: 'None' },
  ...LANGUAGES.map((l) => ({
    value: l.iso1,
    label: l.native === l.english ? l.english : `${l.native} (${l.english})`,
  })),
  ...OVERLAY_VARIANT_OPTIONS,
];

// === Conversion + matching functions ===

/**
 * Map an ISO 639-1 (2-letter) or ISO 639-2 (3-letter) language code to a
 * display label (e.g. "en" -> "English", "kor" -> "Korean").
 *
 * @param code - Language code (2 or 3 letters, case-insensitive)
 * @returns Display label (lowercase), or null if the code is not recognized
 */
export function isoCodeToLabel(code: string): string | null {
  if (!/^[a-z]{2,3}$/i.test(code)) return null;
  const label = ISO_LANGUAGE_MAP.get(code.toLowerCase());
  return label ? label.toLowerCase() : null;
}

/**
 * Validate whether a candidate string is a recognized ISO 639-1 (2-letter) or
 * ISO 639-2 (3-letter) language code. Used by `extractLanguage` in the subtitle
 * detector to reject URL path segments that match the BCP47 shape but are not
 * real language codes (e.g. "sub", "vid", "api" folder names).
 *
 * @param code - Candidate language code (case-insensitive)
 * @returns true if the code is a recognized ISO 639-1/639-2 language code
 */
export function isValidIsoCode(code: string): boolean {
  if (!/^[a-z]{2,3}$/i.test(code)) return false;
  return ISO_LANGUAGE_MAP.has(code.toLowerCase());
}

/**
 * Normalize an ISO 639 code to its 2-letter (ISO 639-1) form when one exists.
 * Returns the input unchanged if it is already 2-letter, or if no 2-letter
 * equivalent exists (some languages only have 639-2 codes).
 *
 * Why: settings (`subtitleOverlayTargetLanguage`, etc.) and `labelToIsoCode`
 * use ISO 639-1 (`en`, `es`). URL-extracted codes may be 639-2 (`eng`, `spa`)
 * — without normalization, comparisons fail even when the language is correct.
 */
export function toIso6391(code: string): string {
  const lower = code.toLowerCase();
  if (lower.length === 2) return lower;
  return ISO_639_2_TO_639_1.get(lower) ?? lower;
}

/**
 * Map a language display label (e.g. "English", "english", "Vietnamese")
 * back to its ISO 639-1 (2-letter) code (e.g. "en", "vi").
 *
 * @param label - Language label (case-insensitive)
 * @returns ISO 639-1 code, or null if the label is not recognized
 */
export function labelToIsoCode(label: string): string | null {
  if (!label) return null;
  return LABEL_TO_ISO_CODE.get(label.toLowerCase()) ?? null;
}

/**
 * Check whether a subtitle language tag matches a target language.
 * BCP 47 subtag-aware so that:
 * - `zh` matches `zh-hans`, `zh-hant`, and `zh`
 * - `zh-hans` matches `zh-hans` and falls back to generic `zh`
 * - `en` matches `en`, `en-US`, etc.
 *
 * This is the single matching function for the whole extension — all language
 * comparisons (auto-load, subtitle selector, import role assignment,
 * auto-download filter) go through here so behavior is consistent.
 */
export function languageMatches(target: string, candidate: string): boolean {
  const t = target.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();
  if (t === c) return true;
  if (c.startsWith(t + '-')) return true; // candidate is a subtag of target (target is broader)
  if (t.startsWith(c + '-')) return true; // target is a subtag of candidate (candidate is broader)
  return false;
}
