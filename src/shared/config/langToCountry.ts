/**
 * Map ISO 639-1 (language) → ISO 3166-1 alpha-2 (country) for flag display.
 *
 * Language codes don't have flags — countries do. This map picks the primary
 * country for each language (usually the origin or most populous speaker).
 * Languages without a primary country (Latin, Esperanto, etc.) map to null
 * and fall back to the `languages` icon in FlagIcon.
 *
 * BCP 47 script variants (zh-hans, zh-hant) are included alongside their
 * parent codes.
 *
 * Source: LANGUAGES in languageRegistry.ts (182 entries).
 * When adding a new language to LANGUAGES, add its country mapping here too.
 */

/** ISO 639-1 language code → ISO 3166-1 alpha-2 country code (or null). */
export const LANG_TO_COUNTRY: ReadonlyMap<string, string | null> = new Map([
  ['aa', 'ET'], // Afar → Ethiopia
  ['ab', 'GE'], // Abkhazian → Georgia
  ['af', 'ZA'], // Afrikaans → South Africa
  ['ak', 'GH'], // Akan → Ghana
  ['am', 'ET'], // Amharic → Ethiopia
  ['ar', 'SA'], // Arabic → Saudi Arabia
  ['as', 'IN'], // Assamese → India
  ['av', 'RU'], // Avaric → Russia
  ['ay', 'BO'], // Aymara → Bolivia
  ['az', 'AZ'], // Azerbaijani → Azerbaijan
  ['ba', 'RU'], // Bashkir → Russia
  ['be', 'BY'], // Belarusian → Belarus
  ['bg', 'BG'], // Bulgarian → Bulgaria
  ['bh', 'IN'], // Bihari → India
  ['bi', 'VU'], // Bislama → Vanuatu
  ['bm', 'ML'], // Bambara → Mali
  ['bn', 'BD'], // Bengali → Bangladesh
  ['bo', 'CN'], // Tibetan → China
  ['br', 'FR'], // Breton → France
  ['bs', 'BA'], // Bosnian → Bosnia and Herzegovina
  ['ca', 'ES'], // Catalan → Spain
  ['ce', 'RU'], // Chechen → Russia
  ['ch', 'GU'], // Chamorro → Guam
  ['co', 'FR'], // Corsican → France
  ['cr', 'CA'], // Cree → Canada
  ['cs', 'CZ'], // Czech → Czech Republic
  ['cu', null], // Church Slavic → no country
  ['cv', 'RU'], // Chuvash → Russia
  ['cy', 'GB'], // Welsh → United Kingdom
  ['da', 'DK'], // Danish → Denmark
  ['de', 'DE'], // German → Germany
  ['dv', 'MV'], // Dhivehi → Maldives
  ['dz', 'BT'], // Dzongkha → Bhutan
  ['ee', 'GH'], // Ewe → Ghana
  ['el', 'GR'], // Greek → Greece
  ['en', 'GB'], // English → United Kingdom
  ['eo', null], // Esperanto → no country
  ['es', 'ES'], // Spanish → Spain
  ['et', 'EE'], // Estonian → Estonia
  ['eu', 'ES'], // Basque → Spain
  ['fa', 'IR'], // Persian → Iran
  ['ff', 'SN'], // Fulah → Senegal
  ['fi', 'FI'], // Finnish → Finland
  ['fj', 'FJ'], // Fijian → Fiji
  ['fo', 'FO'], // Faroese → Faroe Islands
  ['fr', 'FR'], // French → France
  ['fy', 'NL'], // Western Frisian → Netherlands
  ['ga', 'IE'], // Irish → Ireland
  ['gd', 'GB'], // Scottish Gaelic → United Kingdom
  ['gl', 'ES'], // Galician → Spain
  ['gn', 'PY'], // Guarani → Paraguay
  ['gu', 'IN'], // Gujarati → India
  ['gv', 'IM'], // Manx → Isle of Man
  ['ha', 'NG'], // Hausa → Nigeria
  ['he', 'IL'], // Hebrew → Israel
  ['hi', 'IN'], // Hindi → India
  ['ho', 'PG'], // Hiri Motu → Papua New Guinea
  ['hr', 'HR'], // Croatian → Croatia
  ['ht', 'HT'], // Haitian Creole → Haiti
  ['hu', 'HU'], // Hungarian → Hungary
  ['hy', 'AM'], // Armenian → Armenia
  ['hz', 'NA'], // Herero → Namibia
  ['ia', null], // Interlingua → no country
  ['id', 'ID'], // Indonesian → Indonesia
  ['ie', null], // Interlingue → no country
  ['ig', 'NG'], // Igbo → Nigeria
  ['ii', 'CN'], // Sichuan Yi → China
  ['ik', 'US'], // Inupiaq → United States
  ['io', null], // Ido → no country
  ['is', 'IS'], // Icelandic → Iceland
  ['it', 'IT'], // Italian → Italy
  ['iu', 'CA'], // Inuktitut → Canada
  ['ja', 'JP'], // Japanese → Japan
  ['jv', 'ID'], // Javanese → Indonesia
  ['ka', 'GE'], // Georgian → Georgia
  ['kg', 'CD'], // Kongo → DR Congo
  ['ki', 'KE'], // Kikuyu → Kenya
  ['kj', 'NA'], // Kwanyama → Namibia
  ['kk', 'KZ'], // Kazakh → Kazakhstan
  ['kl', 'GL'], // Kalaallisut → Greenland
  ['km', 'KH'], // Khmer → Cambodia
  ['kn', 'IN'], // Kannada → India
  ['ko', 'KR'], // Korean → South Korea
  ['kr', 'NG'], // Kanuri → Nigeria
  ['ks', 'IN'], // Kashmiri → India
  ['ku', 'TR'], // Kurdish → Turkey
  ['kv', 'RU'], // Komi → Russia
  ['kw', 'GB'], // Cornish → United Kingdom
  ['ky', 'KG'], // Kyrgyz → Kyrgyzstan
  ['la', null], // Latin → no country
  ['lb', 'LU'], // Luxembourgish → Luxembourg
  ['lg', 'UG'], // Ganda → Uganda
  ['li', 'NL'], // Limburgan → Netherlands
  ['ln', 'CD'], // Lingala → DR Congo
  ['lo', 'LA'], // Lao → Laos
  ['lt', 'LT'], // Lithuanian → Lithuania
  ['lu', 'CD'], // Luba-Katanga → DR Congo
  ['lv', 'LV'], // Latvian → Latvia
  ['mg', 'MG'], // Malagasy → Madagascar
  ['mh', 'MH'], // Marshallese → Marshall Islands
  ['mi', 'NZ'], // Maori → New Zealand
  ['mk', 'MK'], // Macedonian → North Macedonia
  ['ml', 'IN'], // Malayalam → India
  ['mn', 'MN'], // Mongolian → Mongolia
  ['mr', 'IN'], // Marathi → India
  ['ms', 'MY'], // Malay → Malaysia
  ['mt', 'MT'], // Maltese → Malta
  ['my', 'MM'], // Burmese → Myanmar
  ['na', 'NR'], // Nauru → Nauru
  ['nb', 'NO'], // Norwegian Bokmål → Norway
  ['nd', 'ZW'], // North Ndebele → Zimbabwe
  ['ne', 'NP'], // Nepali → Nepal
  ['ng', 'NA'], // Ndonga → Namibia
  ['nl', 'NL'], // Dutch → Netherlands
  ['nn', 'NO'], // Norwegian Nynorsk → Norway
  ['no', 'NO'], // Norwegian → Norway
  ['nr', 'ZA'], // South Ndebele → South Africa
  ['nv', 'US'], // Navajo → United States
  ['ny', 'MW'], // Chichewa → Malawi
  ['oc', 'FR'], // Occitan → France
  ['oj', 'CA'], // Ojibwa → Canada
  ['om', 'ET'], // Oromo → Ethiopia
  ['or', 'IN'], // Oriya → India
  ['os', 'GE'], // Ossetian → Georgia
  ['pa', 'IN'], // Punjabi → India
  ['pi', null], // Pali → no country
  ['pl', 'PL'], // Polish → Poland
  ['ps', 'AF'], // Pashto → Afghanistan
  ['pt', 'PT'], // Portuguese → Portugal
  ['qu', 'PE'], // Quechua → Peru
  ['rm', 'CH'], // Romansh → Switzerland
  ['rn', 'BI'], // Kirundi → Burundi
  ['ro', 'RO'], // Romanian → Romania
  ['ru', 'RU'], // Russian → Russia
  ['rw', 'RW'], // Kinyarwanda → Rwanda
  ['sa', 'IN'], // Sanskrit → India
  ['sc', 'IT'], // Sardinian → Italy
  ['sd', 'PK'], // Sindhi → Pakistan
  ['se', 'NO'], // Northern Sami → Norway
  ['sg', 'CF'], // Sango → Central African Republic
  ['si', 'LK'], // Sinhala → Sri Lanka
  ['sk', 'SK'], // Slovak → Slovakia
  ['sl', 'SI'], // Slovenian → Slovenia
  ['sm', 'WS'], // Samoan → Samoa
  ['sn', 'ZW'], // Shona → Zimbabwe
  ['so', 'SO'], // Somali → Somalia
  ['sq', 'AL'], // Albanian → Albania
  ['sr', 'RS'], // Serbian → Serbia
  ['ss', 'SZ'], // Swati → Eswatini
  ['st', 'LS'], // Southern Sotho → Lesotho
  ['su', 'ID'], // Sundanese → Indonesia
  ['sv', 'SE'], // Swedish → Sweden
  ['sw', 'KE'], // Swahili → Kenya
  ['ta', 'IN'], // Tamil → India
  ['te', 'IN'], // Telugu → India
  ['tg', 'TJ'], // Tajik → Tajikistan
  ['th', 'TH'], // Thai → Thailand
  ['ti', 'ER'], // Tigrinya → Eritrea
  ['tk', 'TM'], // Turkmen → Turkmenistan
  ['tl', 'PH'], // Tagalog → Philippines
  ['tn', 'BW'], // Tswana → Botswana
  ['to', 'TO'], // Tongan → Tonga
  ['tr', 'TR'], // Turkish → Turkey
  ['ts', 'ZA'], // Tsonga → South Africa
  ['tt', 'RU'], // Tatar → Russia
  ['tw', 'GH'], // Twi → Ghana
  ['ty', 'PF'], // Tahitian → French Polynesia
  ['ug', 'CN'], // Uyghur → China
  ['uk', 'UA'], // Ukrainian → Ukraine
  ['ur', 'PK'], // Urdu → Pakistan
  ['uz', 'UZ'], // Uzbek → Uzbekistan
  ['ve', 'ZA'], // Venda → South Africa
  ['vi', 'VN'], // Vietnamese → Vietnam
  ['vo', null], // Volapük → no country
  ['wa', 'BE'], // Walloon → Belgium
  ['wo', 'SN'], // Wolof → Senegal
  ['xh', 'ZA'], // Xhosa → South Africa
  ['yi', null], // Yiddish → no country
  ['yo', 'NG'], // Yoruba → Nigeria
  ['za', 'CN'], // Zhuang → China
  ['zh', 'CN'], // Chinese → China
  ['zu', 'ZA'], // Zulu → South Africa
  // BCP 47 script variants
  ['zh-hans', 'CN'], // Simplified Chinese → China
  ['zh-hant', 'TW'], // Traditional Chinese → Taiwan
]);

/**
 * Resolve a language code (ISO 639-1 or BCP 47 variant) to an ISO 3166-1
 * alpha-2 country code for flag display. Returns null for languages without
 * a primary country.
 */
export function langToCountry(lang: string): string | null {
  const lower = lang.toLowerCase();
  return LANG_TO_COUNTRY.get(lower) ?? null;
}
