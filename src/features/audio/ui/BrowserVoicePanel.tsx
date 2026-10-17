import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@/shared/i18n';
import { claimExclusiveAudio, stopExclusiveAudio } from '@/shared/lib/exclusiveAudio';
import { Button, Icon, SettingsRow, Text } from '@/shared/ui';
import { OVERLAY_LANGUAGE_OPTIONS, isoCodeToLabel } from '@/shared/config/languageRegistry';
import { createTtsEngine } from '@/features/tts';
import type { TtsEngine, TtsVoiceInfo } from '@/features/tts';
import type { TtsSettings } from '@/entities/settings/types';
import styles from './BrowserVoicePanel.module.css';

export const BROWSER_VOICE_MAX_SLOTS = 3;
const REFRESH_MS = 1500;
const SAVED_FLASH_MS = 1400;

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
  const [fullFlash, setFullFlash] = useState(0);
  const savedTimer = useRef<number | undefined>(undefined);

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
      stopExclusiveAudio();
    };
  }, []);

  useEffect(() => () => {
    clearTimeout(savedTimer.current);
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
        setFullFlash((n) => n + 1);
      }
    },
    [slots, settings, onChange, flashSaved],
  );

  const preview = useCallback(
    (v: TtsVoiceInfo) => {
      const engine = engineRef.current;
      if (!engine) return;
      setPlaying(v.voiceName);
      const release = claimExclusiveAudio(() => engine.stop());
      engine.speak(t('tts.testDefault'), {
        voiceName: v.voiceName,
        langCode: v.lang ?? targetLang,
      }).catch(() => {})
        .finally(() => {
          release();
          setPlaying((p) => (p === v.voiceName ? null : p));
        });
    },
    [targetLang],
  );

  const savedVisible = savedCount > 0 && savedCount % 2 === 1;
  const full = slots.length >= BROWSER_VOICE_MAX_SLOTS;

  return (
    <div className={styles.panel} data-tihoka-id="browser-voice-panel">
      <SettingsRow
        dense
        title={t('audio.voice.listTitle', [langLabel])}
        hint={t('audio.voice.hint')}
        hintAriaLabel={t('audio.voice.hintAria', [t('audio.voice.listTitle', [langLabel])])}
      >
        <Text
          variant="supporting"
          color="secondary"
          className={styles.count}
          key={slots.length}
        >
          {t('audio.voice.count', [slots.length])}
        </Text>
      </SettingsRow>

      {loading && <Text color="secondary">{t('tts.voicesLoading')}</Text>}

      {!loading && filtered.length === 0 && (
        <Text color="secondary">{t('tts.voicesEmpty')}</Text>
      )}

      {!loading && filtered.length > 0 && (
        <ul
          className={styles.list}
          data-full={full || undefined}
          aria-label={t('audio.voice.listTitle', [langLabel])}
        >
          {filtered.map((v) => {
            const slot = slots.indexOf(v.voiceName);
            const used = slot >= 0;
            const name = displayName(v.voiceName);
            return (
              <li key={v.voiceName} className={styles.item}>
                <Button
                  shape="circle"
                  size="xs"
                  variant={playing === v.voiceName ? 'primary' : 'ghost'}
                  className={`${styles.play}${playing === v.voiceName ? ` ${styles.playActive}` : ''}`}
                  aria-label={t('tts.playVoice', [name])}
                  title={t('tts.playVoice', [name])}
                  onClick={() => preview(v)}
                  data-tihoka-id={`voice-play-${v.voiceName}`}
                >
                  <Icon name={playing === v.voiceName ? 'pause' : 'play'} />
                </Button>
                <Button
                  variant="unstyled"
                  className={`${styles.row}${used ? ` ${styles.rowOn}` : ''}`}
                  aria-pressed={used}
                  onClick={() => toggle(v.voiceName)}
                  data-tihoka-id={`voice-row-${v.voiceName}`}
                >
                  <span className={styles.voiceLabel}>
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
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {(savedVisible || full) && (
        <p
          className={styles.full}
          role="status"
          key={full ? `full-${fullFlash}` : `saved-${savedCount}`}
        >
          {full ? (
            t('audio.voice.full')
          ) : (
            <span className={styles.saved}>
              <Icon name="check" size="sm" />
              {t('audio.voice.saved')}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
