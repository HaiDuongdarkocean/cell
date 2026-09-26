import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@/shared/i18n';
import { Button, HintIcon, Icon, Text } from '@/shared/ui';
import { OVERLAY_LANGUAGE_OPTIONS, isoCodeToLabel } from '@/shared/config/languageRegistry';
import { createTtsEngine } from '@/features/tts';
import type { TtsEngine, TtsVoiceInfo } from '@/features/tts';
import type { TtsSettings } from '@/entities/settings/types';
import styles from './BrowserVoicePanel.module.css';

export const BROWSER_VOICE_MAX_SLOTS = 3;
const REFRESH_MS = 1500;
const SAVED_FLASH_MS = 1400;
const FULL_HINT_MS = 2600;

export interface BrowserVoicePanelProps {
  readonly settings: TtsSettings;
  readonly onChange: (tts: TtsSettings) => void;
  readonly targetLang: string;
}

function displayName(voiceName: string): string {
  return voiceName
    .replace(/^Microsoft\s+/, '')
    .replace(/\s+Online \(Natural\)\s*-\s*/i, ' ')
    .replace(/\s+-\s+.*$/, '')
    .trim();
}

export function BrowserVoicePanel({
  settings,
  onChange,
  targetLang,
}: BrowserVoicePanelProps): React.JSX.Element {
  const engineRef = useRef<TtsEngine | null>(null);
  if (engineRef.current === null) {
    try {
      engineRef.current = createTtsEngine();
    } catch {
      engineRef.current = null;
    }
  }

  const [voices, setVoices] = useState<readonly TtsVoiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [fullHint, setFullHint] = useState(false);
  const savedTimer = useRef<number | undefined>(undefined);
  const fullTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      setLoading(false);
      return;
    }
    let alive = true;
    const load = () => {
      engine.getVoices().then((all) => {
        if (alive) {
          setVoices(all);
          setLoading(false);
        }
      }).catch(() => {
        if (alive) setLoading(false);
      });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
      engine.stop();
    };
  }, []);

  useEffect(() => () => {
    clearTimeout(savedTimer.current);
    clearTimeout(fullTimer.current);
  }, []);

  const filtered = useMemo(() => {
    const prefix = targetLang.toLowerCase();
    const match = voices.filter((v) => v.lang?.toLowerCase().startsWith(prefix));
    return match.length > 0 ? match : voices;
  }, [voices, targetLang]);

  const slots = settings.voices;
  const isoLabel = isoCodeToLabel(targetLang);
  const langLabel =
    OVERLAY_LANGUAGE_OPTIONS.find((o) => o.value === targetLang)?.label
    ?? (isoLabel ? isoLabel.charAt(0).toUpperCase() + isoLabel.slice(1) : targetLang.toUpperCase());

  const flashSaved = useCallback(() => {
    setSavedCount((n) => n + 1);
    clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedCount((n) => n + 1), SAVED_FLASH_MS);
  }, []);

  const toggle = useCallback(
    (voiceName: string) => {
      if (slots.includes(voiceName)) {
        onChange({ ...settings, voices: slots.filter((s) => s !== voiceName) });
        flashSaved();
      } else if (slots.length < BROWSER_VOICE_MAX_SLOTS) {
        onChange({ ...settings, voices: [...slots, voiceName] });
        flashSaved();
      } else {
        setFullHint(true);
        clearTimeout(fullTimer.current);
        fullTimer.current = window.setTimeout(() => setFullHint(false), FULL_HINT_MS);
      }
    },
    [slots, settings, onChange, flashSaved],
  );

  const preview = useCallback(
    (v: TtsVoiceInfo) => {
      const engine = engineRef.current;
      if (!engine) return;
      setPlaying(v.voiceName);
      engine.speak(t('tts.testDefault'), {
        voiceName: v.voiceName,
        langCode: v.lang ?? targetLang,
      }).catch(() => {})
        .finally(() => setPlaying((p) => (p === v.voiceName ? null : p)));
    },
    [targetLang],
  );

  const savedVisible = savedCount > 0 && savedCount % 2 === 1;

  return (
    <div className={styles.panel} data-cell-id="browser-voice-panel">
      <div className={styles.head}>
        <Text as="span" variant="label" className={styles.title}>
          {t('audio.voice.listTitle', [langLabel])}
        </Text>
        <HintIcon
          hint={t('audio.voice.hint')}
          ariaLabel={t('audio.voice.hintAria', [t('audio.voice.listTitle', [langLabel])])}
        />
        <span className={styles.spacer} />
        <span className={styles.count} key={slots.length}>
          {t('audio.voice.count', [slots.length])}
        </span>
        {savedVisible && (
          <span className={styles.saved} key={savedCount} role="status">
            <Icon name="check" size="sm" />
            {t('audio.voice.saved')}
          </span>
        )}
      </div>

      {loading && <Text color="secondary">{t('tts.voicesLoading')}</Text>}

      {!loading && filtered.length === 0 && (
        <Text color="secondary">{t('tts.voicesEmpty')}</Text>
      )}

      {!loading && filtered.length > 0 && (
        <ul className={styles.list} aria-label={t('audio.voice.listTitle', [langLabel])}>
          {filtered.map((v) => {
            const slot = slots.indexOf(v.voiceName);
            const used = slot >= 0;
            const name = displayName(v.voiceName);
            return (
              <li key={v.voiceName}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`${styles.row}${used ? ` ${styles.rowOn}` : ''}`}
                  aria-pressed={used}
                  onClick={() => toggle(v.voiceName)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(v.voiceName);
                    }
                  }}
                  data-cell-id={`voice-row-${v.voiceName}`}
                >
                  <Button
                    shape="circle"
                    size="xs"
                    variant={playing === v.voiceName ? 'primary' : 'ghost'}
                    className={`${styles.play}${playing === v.voiceName ? ` ${styles.playActive}` : ''}`}
                    aria-label={t('tts.playVoice', [name])}
                    title={t('tts.playVoice', [name])}
                    onClick={(e) => {
                      e.stopPropagation();
                      preview(v);
                    }}
                    data-cell-id={`voice-play-${v.voiceName}`}
                  >
                    <Icon name={playing === v.voiceName ? 'pause' : 'play'} />
                  </Button>
                  <span className={styles.rowLabel}>
                    <span className={styles.rowName}>{name}</span>
                    <span className={styles.rowMeta}>
                      {v.lang ?? ''}
                      {/natural|neural/i.test(v.voiceName) ? ` · ${t('audio.voice.natural')}` : ''}
                    </span>
                  </span>
                  <span className={`${styles.check}${used ? ` ${styles.checkOn}` : ''}`}>
                    {used && (
                      <span className={styles.checkNum} key={slot}>
                        {slot + 1}
                      </span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {fullHint && (
        <p className={styles.full} role="status">
          {t('audio.voice.full')}
        </p>
      )}
    </div>
  );
}
