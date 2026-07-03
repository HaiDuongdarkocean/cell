import { useEffect, useRef, useState } from 'react';
import type { Settings, VideoQuality, ConvertToMp4Mode, ParallelConversionMode, FilenameSource, ShortcutAction, NavClusterSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
  MAX_CONVERT_BYTES,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
} from '@/shared/config/config';
import { MultiSelect } from './MultiSelect';
import { SubtitleStylePanel } from './SubtitleStylePanel';
import { SubtitlePreview } from './SubtitlePreview';
import { NavClusterSettingsPanel } from './NavClusterSettingsPanel';
import { IconButton } from '@/shared/ui/IconButton';
import { Toggle } from '@/shared/ui/Toggle';
import { ShortcutInput } from '@/shared/ui/ShortcutInput';
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
  // ADR-013: tab state for Target/Native style panel (kept here so tab switch
  // preserves state — panel unmounts/remounts would lose unsaved slider drag)
  const [styleTab, setStyleTab] = useState<'target' | 'native'>('target');
  // Active section for sidebar highlight (YouTube/Google style pill active)
  const [activeSection, setActiveSection] = useState<string>('media');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const mainColRef = useRef<HTMLDivElement>(null);

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

  // IntersectionObserver: update active sidebar item on scroll
  // Guard for jsdom (test env) which lacks IntersectionObserver — sidebar still works via click
  useEffect(() => {
    if (!isOpen) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const mainCol = mainColRef.current;
    if (!mainCol) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-section');
            if (id) setActiveSection(id);
          }
        });
      },
      { root: mainCol, rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isOpen]);

  if (!isOpen) return <div />;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  // ADR-018: partial update cho nav cluster settings (flat keys)
  const updateNavCluster = (partial: Partial<NavClusterSettings>): void => {
    const flat: Record<string, unknown> = {};
    if (partial.enabled !== undefined) flat.navClusterEnabled = partial.enabled;
    if (partial.position !== undefined) flat.navClusterPosition = partial.position;
    if (partial.buttonSize !== undefined) flat.navClusterButtonSize = partial.buttonSize;
    if (partial.bgOpacity !== undefined) flat.navClusterBgOpacity = partial.bgOpacity;
    if (partial.buttonOpacity !== undefined) flat.navClusterButtonOpacity = partial.buttonOpacity;
    if (partial.collapsed !== undefined) flat.navClusterCollapsed = partial.collapsed;
    onChange({ ...settings, ...flat } as Settings);
  };

  // ADR-013: partial update cho overlay style (target or native)
  const updateOverlayStyle = (role: 'target' | 'native', partial: Partial<OverlayStyleConfig>): void => {
    const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
    const current = settings[key] ?? (role === 'target' ? DEFAULT_OVERLAY_STYLE_TARGET : DEFAULT_OVERLAY_STYLE_NATIVE);
    onChange({ ...settings, [key]: { ...current, ...partial } });
  };

  const resetOverlayStyle = (role: 'target' | 'native'): void => {
    const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
    const defaults = role === 'target' ? DEFAULT_OVERLAY_STYLE_TARGET : DEFAULT_OVERLAY_STYLE_NATIVE;
    onChange({ ...settings, [key]: defaults });
  };

  const handleSidebarClick = (sectionId: string): void => {
    const target = sectionRefs.current[sectionId];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  };

  const sidebarItems: { id: string; label: string }[] = [
    { id: 'media', label: 'Media' },
    { id: 'overlay', label: 'Overlay' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'navcluster', label: 'Nav Cluster' },
    { id: 'download', label: 'Download' },
  ];

  return (
    <>
      {/* Overlay */}
      <div className={`${styles.overlay} ${styles.open}`} onClick={onClose} />

      {/* Popover — 480px, sidebar + cards (YouTube/M3 style) */}
      <div
        className={`${styles.popover} ${styles.open}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className={styles.popoverHeader}>
          <h3 id="settings-title" className={styles.popoverTitle}>Settings</h3>
          <IconButton
            ref={closeButtonRef}
            size="sm"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </IconButton>
        </div>

        <div className={styles.popoverBody}>
          {/* === Sidebar (left, 120px) — YouTube/Google style pill active === */}
          <nav className={styles.sidebar} aria-label="Settings sections">
            <div className={styles.sidebarLabel}>Sections</div>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.sidebarItem} ${activeSection === item.id ? styles.active : ''}`}
                onClick={() => handleSidebarClick(item.id)}
                aria-current={activeSection === item.id ? 'true' : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* === Main column (cards, scrollable) === */}
          <div className={styles.mainCol} ref={mainColRef}>

            {/* === Card 1: Media Selection === */}
            <section
              ref={(el) => { sectionRefs.current.media = el; }}
              className={styles.section}
              data-section="media"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Media Selection</h4>
                <span className={styles.sectionCount}>4</span>
              </div>
              <p className={styles.sectionDescription}>Configure how media is automatically selected and preferred defaults.</p>
              <div className={styles.sectionBody}>
                {/* Auto select media */}
                <div className={styles.field}>
                  <div className={styles.asRow}>
                    <span className={styles.asLabel}>Auto select media</span>
                    <Toggle
                      checked={settings.autoSelectEnabled}
                      onChange={(next) => update('autoSelectEnabled', next)}
                      aria-label="Toggle auto select"
                      title={`Auto select: ${settings.autoSelectEnabled ? 'ON' : 'OFF'}`}
                    />
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
              </div>
            </section>

            {/* === Card 2: Subtitle Overlay === */}
            <section
              ref={(el) => { sectionRefs.current.overlay = el; }}
              className={styles.section}
              data-section="overlay"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Subtitle Overlay</h4>
                <span className={styles.sectionCount}>4</span>
              </div>
              <p className={styles.sectionDescription}>Languages and appearance for the floating subtitle overlay.</p>
              <div className={styles.sectionBody}>
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
                    <Toggle
                      checked={settings.subtitleOverlayAutoLoad}
                      onChange={(next) => update('subtitleOverlayAutoLoad', next)}
                      aria-label="Toggle overlay auto-load"
                      title={`Overlay auto-load: ${settings.subtitleOverlayAutoLoad ? 'ON' : 'OFF'}`}
                    />
                  </div>
                  <p className={styles.asHint}>Khi bật, overlay tự load subtitle detect được cùng target language.</p>
                </div>

                {/* === ADR-013: Subtitle appearance (Target/Native tabs) === */}
                <div className={styles.field}>
                  <label className={styles.label}>Subtitle appearance</label>
                  <div className={styles.tabRow} role="tablist" aria-label="Subtitle style tab">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={styleTab === 'target'}
                      className={`${styles.tabBtn} ${styleTab === 'target' ? styles.tabBtnActive : ''}`}
                      onClick={() => setStyleTab('target')}
                      data-testid="style-tab-target"
                    >
                      Target
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={styleTab === 'native'}
                      className={`${styles.tabBtn} ${styleTab === 'native' ? styles.tabBtnActive : ''}`}
                      onClick={() => setStyleTab('native')}
                      data-testid="style-tab-native"
                    >
                      Native
                    </button>
                  </div>
                  {styleTab === 'target' ? (
                    <>
                      <SubtitlePreview
                        style={settings.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET}
                        role="target"
                      />
                      <SubtitleStylePanel
                        role="target"
                        style={settings.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET}
                        onChange={(partial) => updateOverlayStyle('target', partial)}
                        onReset={() => resetOverlayStyle('target')}
                        defaultStyle={DEFAULT_OVERLAY_STYLE_TARGET}
                      />
                    </>
                  ) : (
                    <>
                      <SubtitlePreview
                        style={settings.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE}
                        role="native"
                      />
                      <SubtitleStylePanel
                        role="native"
                        style={settings.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE}
                        onChange={(partial) => updateOverlayStyle('native', partial)}
                        onReset={() => resetOverlayStyle('native')}
                        defaultStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
                      />
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* === Card 3: Keyboard Shortcuts === */}
            <section
              ref={(el) => { sectionRefs.current.shortcuts = el; }}
              className={styles.section}
              data-section="shortcuts"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Keyboard Shortcuts</h4>
                <span className={styles.sectionCount}>5</span>
              </div>
              <p className={styles.sectionDescription}>Remap keys for subtitle panel navigation actions.</p>
              <div className={styles.sectionBody}>
                <p className={styles.hint}>Single character per action.</p>
                {SHORTCUT_ACTION_ORDER.map((action) => {
                  const shortcut = settings.keyboardShortcuts.find((s) => s.action === action);
                  const currentKey = shortcut?.key ?? '';
                  return (
                    <SettingField key={action} label={SHORTCUT_ACTION_LABELS[action]} htmlFor={`set-shortcut-${action}`}>
                      <ShortcutInput
                        id={`set-shortcut-${action}`}
                        data-testid={`shortcut-${action}`}
                        value={currentKey}
                        onChange={(newKey) => {
                          const updated = settings.keyboardShortcuts.map((s) =>
                            s.action === action ? { ...s, key: newKey } : s,
                          );
                          update('keyboardShortcuts', updated);
                        }}
                        aria-label={SHORTCUT_ACTION_LABELS[action]}
                      />
                    </SettingField>
                  );
                })}
              </div>
            </section>

            {/* === Card 4: Navigation Cluster === */}
            <section
              ref={(el) => { sectionRefs.current.navcluster = el; }}
              className={styles.section}
              data-section="navcluster"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Navigation Cluster</h4>
                <span className={styles.sectionCount}>5</span>
              </div>
              <p className={styles.sectionDescription}>Floating subtitle navigation buttons on video pages.</p>
              <div className={styles.sectionBody}>
                <NavClusterSettingsPanel
                  settings={{
                    enabled: settings.navClusterEnabled,
                    position: settings.navClusterPosition,
                    buttonSize: settings.navClusterButtonSize,
                    bgOpacity: settings.navClusterBgOpacity,
                    buttonOpacity: settings.navClusterButtonOpacity,
                    collapsed: settings.navClusterCollapsed,
                  }}
                  onChange={updateNavCluster}
                />
              </div>
            </section>

            {/* === Card 5: Download === */}
            <section
              ref={(el) => { sectionRefs.current.download = el; }}
              className={styles.section}
              data-section="download"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Download</h4>
                <span className={styles.sectionCount}>5</span>
              </div>
              <p className={styles.sectionDescription}>Download concurrency, conversion, and filename options.</p>
              <div className={styles.sectionBody}>
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

                {/* Workers (only when manual) — dependency pattern: child below parent */}
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

                {/* Filename source */}
                <SettingField label="Filename source" htmlFor="set-filename-source">
                  <CustomSelect
                    testId="filename-source-select"
                    value={settings.filenameSource}
                    options={FILENAME_SOURCE_OPTIONS.map((m) => ({ value: m, label: FILENAME_SOURCE_LABELS[m] }))}
                    onSelect={(val) => update('filenameSource', val as FilenameSource)}
                  />
                </SettingField>

                <p className={styles.hint}>
                  Parallel conversion: {settings.parallelConversion} (số lượng tùy vào GPU của máy tính hiện có)
                </p>
              </div>
            </section>

          </div>
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
