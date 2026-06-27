import { useEffect, useRef, useState } from 'react';
import type { Settings, VideoQuality, ConvertToMp4Mode, ParallelConversionMode, FilenameSource, ShortcutAction } from '@/types/media';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
  MAX_CONVERT_BYTES,
} from '@/constants/config';
import { MultiSelect } from './MultiSelect';
import styles from './SettingsDialog.module.css';

interface SettingsDialogProps {
  isOpen: boolean;
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}

const QUALITY_OPTIONS: readonly VideoQuality[] = ['highest', '1080p', '720p', '480p', '360p', 'lowest', 'auto'];
const QUALITY_LABELS: Record<VideoQuality, string> = {
  highest: 'Highest', '1080p': '1080p', '720p': '720p', '480p': '480p',
  '360p': '360p', lowest: 'Lowest', auto: 'Auto (best)',
};

const CONVERT_OPTIONS: readonly ConvertToMp4Mode[] = ['always', 'small-only', 'never'];
const CONVERT_LABELS: Record<ConvertToMp4Mode, string> = {
  always: 'Always', 'small-only': `Small only (≤${Math.round(MAX_CONVERT_BYTES / 1024 / 1024)}MB)`, never: 'Never',
};

const PARALLEL_OPTIONS: readonly ParallelConversionMode[] = ['off', 'auto', 'manual'];
const PARALLEL_LABELS: Record<ParallelConversionMode, string> = { off: 'Off', auto: 'Auto', manual: 'Manual' };

const WORKER_OPTIONS = [2, 3, 4, 5, 6];

const FILENAME_SOURCE_OPTIONS: readonly FilenameSource[] = ['title-fallback', 'title-only', 'url-only'];
const FILENAME_SOURCE_LABELS: Record<FilenameSource, string> = {
  'title-fallback': 'Title (fallback URL)',
  'title-only': 'Title only',
  'url-only': 'URL only',
};

const PREFERRED_FORMAT_OPTIONS: readonly ('mp4' | 'm3u8')[] = ['m3u8', 'mp4'];
const PREFERRED_FORMAT_LABELS: Record<'mp4' | 'm3u8', string> = {
  m3u8: 'm3u8 (HLS)', mp4: 'mp4 (direct)',
};

const SHORTCUT_ACTION_LABELS: Record<ShortcutAction, string> = {
  'prev-cue': 'Previous cue',
  'next-cue': 'Next cue',
  'replay-cue': 'Replay cue',
  'toggle-overlay': 'Toggle overlay',
  'toggle-panel': 'Toggle panel',
};

const SHORTCUT_ACTION_ORDER: readonly ShortcutAction[] = [
  'prev-cue', 'next-cue', 'replay-cue', 'toggle-overlay', 'toggle-panel',
];

/**
 * Full ISO 639-1 subtitle language list (~184 codes).
 * Format: native name + (English) where they differ.
 * Ordered alphabetically by English name for findability.
 * "All languages" is always first.
 */
const SUBTITLE_LANGUAGES: { value: string; label: string }[] = [
  { value: 'all', label: 'All languages' },
  { value: 'aa', label: 'Afar' },
  { value: 'ab', label: 'Аҧсуа (Abkhazian)' },
  { value: 'af', label: 'Afrikaans' },
  { value: 'ak', label: 'Akan' },
  { value: 'am', label: 'አማርኛ (Amharic)' },
  { value: 'ar', label: 'العربية (Arabic)' },
  { value: 'as', label: 'অসমীয়া (Assamese)' },
  { value: 'av', label: 'Авар (Avaric)' },
  { value: 'ay', label: 'Aymar aru (Aymara)' },
  { value: 'az', label: 'Azərbaycan (Azerbaijani)' },
  { value: 'ba', label: 'Башҡорт (Bashkir)' },
  { value: 'be', label: 'Беларуская (Belarusian)' },
  { value: 'bg', label: 'Български (Bulgarian)' },
  { value: 'bh', label: 'भोजपुरी (Bihari)' },
  { value: 'bi', label: 'Bislama' },
  { value: 'bm', label: 'Bambara' },
  { value: 'bn', label: 'বাংলা (Bengali)' },
  { value: 'bo', label: 'བོད་སྐད་ (Tibetan)' },
  { value: 'br', label: 'Brezhoneg (Breton)' },
  { value: 'bs', label: 'Bosanski (Bosnian)' },
  { value: 'ca', label: 'Català (Catalan)' },
  { value: 'ce', label: 'Нохчийн (Chechen)' },
  { value: 'ch', label: 'Chamoru (Chamorro)' },
  { value: 'co', label: 'Corsu (Corsican)' },
  { value: 'cr', label: 'ᓀᐦᐃᔭᐍᐏᐣ (Cree)' },
  { value: 'cs', label: 'Čeština (Czech)' },
  { value: 'cu', label: 'Славе́нскїй (Church Slavic)' },
  { value: 'cv', label: 'Чӑвашла (Chuvash)' },
  { value: 'cy', label: 'Cymraeg (Welsh)' },
  { value: 'da', label: 'Dansk (Danish)' },
  { value: 'de', label: 'Deutsch (German)' },
  { value: 'dv', label: 'ދިވެހި (Dhivehi)' },
  { value: 'dz', label: 'རྫོང་ཁ (Dzongkha)' },
  { value: 'ee', label: 'Eʋegbe (Ewe)' },
  { value: 'el', label: 'Ελληνικά (Greek)' },
  { value: 'en', label: 'English' },
  { value: 'eo', label: 'Esperanto' },
  { value: 'es', label: 'Español (Spanish)' },
  { value: 'et', label: 'Eesti (Estonian)' },
  { value: 'eu', label: 'Euskara (Basque)' },
  { value: 'fa', label: 'فارسی (Persian)' },
  { value: 'ff', label: 'Fulfulde (Fulah)' },
  { value: 'fi', label: 'Suomi (Finnish)' },
  { value: 'fj', label: 'Vosa Vakaviti (Fijian)' },
  { value: 'fo', label: 'Føroyskt (Faroese)' },
  { value: 'fr', label: 'Français (French)' },
  { value: 'fy', label: 'Frysk (Western Frisian)' },
  { value: 'ga', label: 'Gaeilge (Irish)' },
  { value: 'gd', label: 'Gàidhlig (Scottish Gaelic)' },
  { value: 'gl', label: 'Galego (Galician)' },
  { value: 'gn', label: 'Avañeẽ (Guarani)' },
  { value: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { value: 'gv', label: 'Gaelg (Manx)' },
  { value: 'ha', label: 'Hausa' },
  { value: 'he', label: 'עברית (Hebrew)' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'ho', label: 'Hiri Motu' },
  { value: 'hr', label: 'Hrvatski (Croatian)' },
  { value: 'ht', label: 'Kreyòl Ayisyen (Haitian Creole)' },
  { value: 'hu', label: 'Magyar (Hungarian)' },
  { value: 'hy', label: 'Հայերեն (Armenian)' },
  { value: 'hz', label: 'Oshiwambo (Herero)' },
  { value: 'ia', label: 'Interlingua' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'ie', label: 'Interlingue' },
  { value: 'ig', label: 'Igbo' },
  { value: 'ii', label: 'ꆈꌠꉙ (Sichuan Yi)' },
  { value: 'ik', label: 'Iñupiaq' },
  { value: 'io', label: 'Ido' },
  { value: 'is', label: 'Íslenska (Icelandic)' },
  { value: 'it', label: 'Italiano (Italian)' },
  { value: 'iu', label: 'ᐃᓄᒃᑎᑐᑦ (Inuktitut)' },
  { value: 'ja', label: '日本語 (Japanese)' },
  { value: 'jv', label: 'Basa Jawa (Javanese)' },
  { value: 'ka', label: 'ქართული (Georgian)' },
  { value: 'kg', label: 'Kikongo (Kongo)' },
  { value: 'ki', label: 'Gĩkũyũ (Kikuyu)' },
  { value: 'kj', label: 'Kuanyama (Kwanyama)' },
  { value: 'kk', label: 'Қазақ (Kazakh)' },
  { value: 'kl', label: 'Kalaallisut (Greenlandic)' },
  { value: 'km', label: 'ខ្មែរ (Khmer)' },
  { value: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { value: 'ko', label: '한국어 (Korean)' },
  { value: 'kr', label: 'Kanuri' },
  { value: 'ks', label: 'कश्मीरी (Kashmiri)' },
  { value: 'ku', label: 'Kurdî (Kurdish)' },
  { value: 'kv', label: 'Коми (Komi)' },
  { value: 'kw', label: 'Kernewek (Cornish)' },
  { value: 'ky', label: 'Кыргызча (Kyrgyz)' },
  { value: 'la', label: 'Latina (Latin)' },
  { value: 'lb', label: 'Lëtzebuergesch (Luxembourgish)' },
  { value: 'lg', label: 'Luganda (Ganda)' },
  { value: 'li', label: 'Limburgs (Limburgan)' },
  { value: 'ln', label: 'Lingála' },
  { value: 'lo', label: 'ລາວ (Lao)' },
  { value: 'lt', label: 'Lietuvių (Lithuanian)' },
  { value: 'lu', label: 'Tshiluba (Luba-Katanga)' },
  { value: 'lv', label: 'Latviešu (Latvian)' },
  { value: 'mg', label: 'Malagasy' },
  { value: 'mh', label: 'Kajin M̧ajeļ (Marshallese)' },
  { value: 'mi', label: 'Te Reo Māori (Maori)' },
  { value: 'mk', label: 'Македонски (Macedonian)' },
  { value: 'ml', label: 'മലയാളം (Malayalam)' },
  { value: 'mn', label: 'Монгол (Mongolian)' },
  { value: 'mr', label: 'मराठी (Marathi)' },
  { value: 'ms', label: 'Bahasa Melayu (Malay)' },
  { value: 'mt', label: 'Malti (Maltese)' },
  { value: 'my', label: 'ဗမာ (Burmese)' },
  { value: 'na', label: 'Dorerin Naoero (Nauru)' },
  { value: 'nb', label: 'Norsk Bokmål (Norwegian Bokmål)' },
  { value: 'nd', label: 'isiNdebele (North Ndebele)' },
  { value: 'ne', label: 'नेपाली (Nepali)' },
  { value: 'ng', label: 'Owambo (Ndonga)' },
  { value: 'nl', label: 'Nederlands (Dutch)' },
  { value: 'nn', label: 'Norsk Nynorsk (Norwegian Nynorsk)' },
  { value: 'no', label: 'Norsk (Norwegian)' },
  { value: 'nr', label: 'isiNdebele (South Ndebele)' },
  { value: 'nv', label: 'Diné bizaad (Navajo)' },
  { value: 'ny', label: 'Chichewa (Nyanja)' },
  { value: 'oc', label: 'Occitan' },
  { value: 'oj', label: 'ᐊᓂᔑᓈᐯᒧᐎᓐ (Ojibwa)' },
  { value: 'om', label: 'Afaan Oromoo (Oromo)' },
  { value: 'or', label: 'ଓଡ଼ିଆ (Oriya)' },
  { value: 'os', label: 'Ирон (Ossetian)' },
  { value: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { value: 'pi', label: 'पालि (Pali)' },
  { value: 'pl', label: 'Polski (Polish)' },
  { value: 'ps', label: 'پښتو (Pashto)' },
  { value: 'pt', label: 'Português (Portuguese)' },
  { value: 'qu', label: 'Runa Simi (Quechua)' },
  { value: 'rm', label: 'Rumantsch (Romansh)' },
  { value: 'rn', label: 'Ikirundi (Kirundi)' },
  { value: 'ro', label: 'Română (Romanian)' },
  { value: 'ru', label: 'Русский (Russian)' },
  { value: 'rw', label: 'Kinyarwanda' },
  { value: 'sa', label: 'संस्कृतम् (Sanskrit)' },
  { value: 'sc', label: 'Sardu (Sardinian)' },
  { value: 'sd', label: 'سنڌي (Sindhi)' },
  { value: 'se', label: 'Davvisámegiella (Northern Sami)' },
  { value: 'sg', label: 'Sängö (Sango)' },
  { value: 'si', label: 'සිංහල (Sinhala)' },
  { value: 'sk', label: 'Slovenčina (Slovak)' },
  { value: 'sl', label: 'Slovenščina (Slovenian)' },
  { value: 'sm', label: 'Gagana Samoa (Samoan)' },
  { value: 'sn', label: 'ChiShona (Shona)' },
  { value: 'so', label: 'Soomaali (Somali)' },
  { value: 'sq', label: 'Shqip (Albanian)' },
  { value: 'sr', label: 'Српски (Serbian)' },
  { value: 'ss', label: 'SiSwati (Swati)' },
  { value: 'st', label: 'Sesotho (Southern Sotho)' },
  { value: 'su', label: 'Basa Sunda (Sundanese)' },
  { value: 'sv', label: 'Svenska (Swedish)' },
  { value: 'sw', label: 'Kiswahili (Swahili)' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'te', label: 'తెలుగు (Telugu)' },
  { value: 'tg', label: 'Тоҷикӣ (Tajik)' },
  { value: 'th', label: 'ไทย (Thai)' },
  { value: 'ti', label: 'ትግርኛ (Tigrinya)' },
  { value: 'tk', label: 'Türkmen (Turkmen)' },
  { value: 'tl', label: 'Filipino (Tagalog)' },
  { value: 'tn', label: 'Setswana (Tswana)' },
  { value: 'to', label: 'Lea Faka-Tonga (Tonga)' },
  { value: 'tr', label: 'Türkçe (Turkish)' },
  { value: 'ts', label: 'Xitsonga (Tsonga)' },
  { value: 'tt', label: 'Татар (Tatar)' },
  { value: 'tw', label: 'Twi' },
  { value: 'ty', label: 'Reo Tahiti (Tahitian)' },
  { value: 'ug', label: 'ئۇيغۇرچە (Uyghur)' },
  { value: 'uk', label: 'Українська (Ukrainian)' },
  { value: 'ur', label: 'اردو (Urdu)' },
  { value: 'uz', label: 'Oʻzbek (Uzbek)' },
  { value: 've', label: 'Tshivenḓa (Venda)' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'vo', label: 'Volapük' },
  { value: 'wa', label: 'Walon (Walloon)' },
  { value: 'wo', label: 'Wolof' },
  { value: 'xh', label: 'isiXhosa (Xhosa)' },
  { value: 'yi', label: 'ייִדיש (Yiddish)' },
  { value: 'yo', label: 'Yorùbá' },
  { value: 'za', label: 'Vahcuengh (Zhuang)' },
  { value: 'zh', label: '中文 (Chinese)' },
  { value: 'zu', label: 'isiZulu (Zulu)' },
];

/**
 * Language options for the overlay target/native dropdowns.
 * Same list as SUBTITLE_LANGUAGES but without the "all" option, with a
 * leading "None" option (value '') so users can clear the selection.
 */
const OVERLAY_LANGUAGE_OPTIONS: DropdownOption[] = [
  { value: '', label: 'None' },
  ...SUBTITLE_LANGUAGES.filter((o) => o.value !== 'all'),
];

export function SettingsDialog({ isOpen, settings, onChange, onClose }: SettingsDialogProps): React.JSX.Element {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return <div />;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <>
      {/* Overlay */}
      <div className={`${styles.overlay} ${styles.open}`} onClick={onClose} />

      {/* Popover — centered, 320px */}
      <div
        className={`${styles.popover} ${styles.open}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className={styles.popoverHeader}>
          <h3 id="settings-title" className={styles.popoverTitle}>Settings</h3>
          <button
            ref={closeButtonRef}
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnSm}`}
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.popoverBody}>
          {/* === Group: chọn media === */}

          {/* Auto select media */}
          <div className={styles.field}>
            <div className={styles.asRow}>
              <span className={styles.asLabel}>Auto select media</span>
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.iconBtnSm} ${settings.autoSelectEnabled ? styles.asActive : ''}`}
                onClick={() => update('autoSelectEnabled', !settings.autoSelectEnabled)}
                aria-pressed={settings.autoSelectEnabled}
                aria-label="Toggle auto select"
                title={`Auto select: ${settings.autoSelectEnabled ? 'ON' : 'OFF'}`}
              >
                <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
                  <path d="M19 15L19.5 16.5L21 17L19.5 17.5L19 19L18.5 17.5L17 17L18.5 16.5L19 15Z" />
                </svg>
              </button>
            </div>
            <p className={styles.asHint}>Khi bật, mở popup → media tự chọn theo preference.</p>
          </div>

          {/* Preferred format */}
          <SettingField label="Preferred format" htmlFor="set-format">
            <CustomSelect
              testId="format-select"
              value={settings.preferredVideoFormat}
              options={PREFERRED_FORMAT_OPTIONS.map((f) => ({ value: f, label: PREFERRED_FORMAT_LABELS[f] }))}
              onSelect={(val) => update('preferredVideoFormat', val as 'mp4' | 'm3u8')}
            />
          </SettingField>

          {/* Default quality */}
          <SettingField label="Default quality" htmlFor="set-quality">
            <CustomSelect
              testId="quality-select"
              value={settings.defaultQuality}
              options={QUALITY_OPTIONS.map((q) => ({ value: q, label: QUALITY_LABELS[q] }))}
              onSelect={(val) => update('defaultQuality', val as VideoQuality)}
            />
          </SettingField>

          {/* Select subtitle */}
          <SettingField label="Select subtitle" htmlFor="set-subtitle-lang">
            <MultiSelect
              testId="subtitle-lang-multiselect"
              options={SUBTITLE_LANGUAGES}
              selectedValues={settings.selectedSubtitleLanguages}
              onChange={(values) => update('selectedSubtitleLanguages', values)}
              placeholder="Search languages..."
            />
          </SettingField>

          {/* === Group: subtitle overlay === */}

          {/* Subtitle overlay target language */}
          <SettingField label="Overlay target language" htmlFor="set-overlay-lang">
            <CustomSelect
              testId="overlay-target-language"
              value={settings.subtitleOverlayTargetLanguage}
              options={OVERLAY_LANGUAGE_OPTIONS}
              onSelect={(val) => update('subtitleOverlayTargetLanguage', val)}
            />
          </SettingField>

          {/* Subtitle overlay native language */}
          <SettingField label="Overlay native language" htmlFor="set-overlay-native-lang">
            <CustomSelect
              testId="overlay-native-language"
              value={settings.subtitleOverlayNativeLanguage}
              options={OVERLAY_LANGUAGE_OPTIONS}
              onSelect={(val) => update('subtitleOverlayNativeLanguage', val)}
            />
          </SettingField>

          {/* Subtitle overlay auto-load */}
          <div className={styles.field}>
            <div className={styles.asRow}>
              <span className={styles.asLabel}>Overlay auto-load</span>
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.iconBtnSm} ${settings.subtitleOverlayAutoLoad ? styles.asActive : ''}`}
                onClick={() => update('subtitleOverlayAutoLoad', !settings.subtitleOverlayAutoLoad)}
                aria-pressed={settings.subtitleOverlayAutoLoad}
                aria-label="Toggle overlay auto-load"
                title={`Overlay auto-load: ${settings.subtitleOverlayAutoLoad ? 'ON' : 'OFF'}`}
              >
                <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
                  <path d="M19 15L19.5 16.5L21 17L19.5 17.5L19 19L18.5 17.5L17 17L18.5 16.5L19 15Z" />
                </svg>
              </button>
            </div>
            <p className={styles.asHint}>Khi bật, overlay tự load subtitle detect được cùng target language.</p>
          </div>

          {/* === Group: keyboard shortcuts === */}
          <div className={styles.field}>
            <label className={styles.label}>Keyboard shortcuts</label>
            <p className={styles.hint}>Remap keys cho subtitle panel actions.</p>
          </div>

          {SHORTCUT_ACTION_ORDER.map((action) => {
            const shortcut = settings.keyboardShortcuts.find((s) => s.action === action);
            const currentKey = shortcut?.key ?? '';
            return (
              <SettingField key={action} label={SHORTCUT_ACTION_LABELS[action]} htmlFor={`set-shortcut-${action}`}>
                <input
                  id={`set-shortcut-${action}`}
                  type="text"
                  data-testid={`shortcut-${action}`}
                  value={currentKey}
                  onChange={(e) => {
                    const newKey = e.target.value.toLowerCase().slice(0, 1);
                    const updated = settings.keyboardShortcuts.map((s) =>
                      s.action === action ? { ...s, key: newKey } : s,
                    );
                    update('keyboardShortcuts', updated);
                  }}
                  maxLength={1}
                  className={styles.textInput}
                  style={{ width: '40px', textAlign: 'center' }}
                />
              </SettingField>
            );
          })}

          {/* === Group: download === */}

          {/* Downloads at once */}
          <SettingField label="Downloads at once" htmlFor="set-concurrent">
            <CustomSelect
              testId="concurrent-select"
              value={String(settings.concurrentDownloads)}
              options={[1, 2, 3, 5, 10].map((n) => ({ value: String(n), label: String(n) }))}
              onSelect={(val) => update('concurrentDownloads', Number(val))}
            />
          </SettingField>

          {/* Convert to MP4 */}
          <SettingField label="Convert to MP4" htmlFor="set-convert">
            <CustomSelect
              testId="convert-select"
              value={settings.convertToMp4}
              options={CONVERT_OPTIONS.map((m) => ({ value: m, label: CONVERT_LABELS[m] }))}
              onSelect={(val) => update('convertToMp4', val as ConvertToMp4Mode)}
            />
          </SettingField>

          {/* Parallel conversion */}
          <SettingField label="Parallel conversion" htmlFor="set-parallel">
            <CustomSelect
              testId="parallel-select"
              value={settings.parallelConversion}
              options={PARALLEL_OPTIONS.map((m) => ({ value: m, label: PARALLEL_LABELS[m] }))}
              onSelect={(val) => update('parallelConversion', val as ParallelConversionMode)}
            />
          </SettingField>

          {/* Workers (only when manual) */}
          {settings.parallelConversion === 'manual' && (
            <SettingField label="Workers" htmlFor="set-workers">
              <CustomSelect
                testId="workers-select"
                value={String(settings.manualWorkerCount)}
                options={WORKER_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                onSelect={(val) => update('manualWorkerCount', Math.max(MIN_PARALLEL_WORKERS, Math.min(MAX_PARALLEL_WORKERS, Number(val))))}
              />
            </SettingField>
          )}

          {/* === Group: filename === */}

          {/* Filename source */}
          <SettingField label="Filename source" htmlFor="set-filename-source">
            <CustomSelect
              testId="filename-source-select"
              value={settings.filenameSource}
              options={FILENAME_SOURCE_OPTIONS.map((m) => ({ value: m, label: FILENAME_SOURCE_LABELS[m] }))}
              onSelect={(val) => update('filenameSource', val as FilenameSource)}
            />
          </SettingField>

          {/* Hint */}
          <p className={styles.hint}>
            Parallel conversion: {settings.parallelConversion} (số lượng tùy vào GPU của máy tính hiện có)
          </p>
        </div>
      </div>
    </>
  );
}

/* === Setting field wrapper === */
function SettingField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

/* === Custom Dropdown — matches prototype exactly === */
interface DropdownOption { value: string; label: string }
interface CustomSelectProps {
  testId: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
}

function CustomSelect({ testId, value, options, onSelect }: CustomSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent): void => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className={`${styles.customSelect} ${open ? styles.open : ''}`} ref={wrapperRef} data-testid={testId}>
      <button
        type="button"
        className={styles.customSelectTrigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.customSelectValue}>{selected?.label}</span>
        <svg className={styles.customSelectChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={`${styles.customSelectMenu} ${styles.menuOpen}`} role="listbox">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`${styles.customSelectOption} ${opt.value === value ? styles.selected : ''}`}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onSelect(opt.value); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
