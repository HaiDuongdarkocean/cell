import { useState, useCallback, useMemo } from 'react';
import { t } from '@/shared/i18n';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { decodeBase64ToArrayBuffer } from '@/shared/lib/base64';
import { claimExclusiveAudio, stopExclusiveAudio } from '@/shared/lib/exclusiveAudio';
import {
  deleteVoice,
  deleteVoicePack,
  SUPERTONIC_MAX_SELECTED_VOICES,
  SUPERTONIC_VOICE_IDS,
} from '@/features/tts/services/ttsDownloadManager';
import { SettingsRow, SettingsGroup, SettingsPanel, Toggle, Select, Button, Icon, Chip, Alert, Text } from '@/shared/ui';
import type { SelectOption } from '@/shared/ui/Select';
import type { TtsSettings } from '@/entities/settings/types';
import type { MessageResponse } from '@/entities/message';
import type { PronunciationSupertonicTtsResult } from '@/entities/message/types';


import { JobRow, useJobs, dismissJob, retryJob } from '@/features/jobs';
import { isActiveJob } from '@/entities/job/types';
import styles from './TtsLanguagePanel.module.css';

const LANGUAGE_LABELS: Readonly<Record<string, string>> = {
  en: 'English',
};

const AVAILABLE_LANGUAGES: readonly SelectOption[] = Object.entries(LANGUAGE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

function languageLabel(lang: string): string {
  return LANGUAGE_LABELS[lang] ?? lang.toUpperCase();
}

function voiceLabel(voice: string): string {
  const num = voice.slice(1);
  return voice.startsWith('F')
    ? t('tts.local.voice.female', [num])
    : t('tts.local.voice.male', [num]);
}

interface TtsLanguagePanelProps {
  readonly settings: TtsSettings;
  readonly onSave: (settings: TtsSettings) => void;
}

export function TtsLanguagePanel({ settings, onSave }: TtsLanguagePanelProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [selectedAdd, setSelectedAdd] = useState<string>('');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);


  // The background JobRegistry owns downloads — the panel observes jobs and
  // the completion effect (downloadedLanguages/localTtsLanguage) lands via
  // the settings subscription, never from this mortal surface.
  const voiceJobs = useJobs('voice-download');
  const visibleJobs = useMemo(() => voiceJobs.filter((j) => j.status !== 'done'), [voiceJobs]);
  const downloadingVoices = useMemo(() => new Set(
    voiceJobs
      .filter((j) => isActiveJob(j))
      .map((j) => j.params.voice)
      .filter((v): v is string => typeof v === 'string'),
  ), [voiceJobs]);
  const activeLanguage = useMemo(() => {
    const active = voiceJobs.find((j) => isActiveJob(j));
    return typeof active?.params.language === 'string' ? active.params.language : null;
  }, [voiceJobs]);

  const languageOptions = useMemo(
    () => settings.downloadedLanguages.map((lang) => ({ value: lang, label: languageLabel(lang) })),
    [settings.downloadedLanguages],
  );

  const setLocalTtsEnabled = useCallback(
    (localTtsEnabled: boolean) => onSave({ ...settings, localTtsEnabled }),
    [onSave, settings],
  );

  const setLocalTtsLanguage = useCallback(
    (localTtsLanguage: string) => onSave({ ...settings, localTtsLanguage }),
    [onSave, settings],
  );

  const handleDownload = useCallback(
    async (language: string) => {
      setError(null);
      try {
        const response = await sendMessage<MessageResponse<{ jobId: string }>>({
          type: MESSAGE_TYPES.TTS_DOWNLOAD_VOICE,
          payload: { language },
        });
        if (!response.success) {
          throw new Error(response.error ?? t('tts.local.downloadFailed'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const handleRedownload = useCallback(
    async (language: string) => handleDownload(language),
    [handleDownload],
  );

  const handleDelete = useCallback(
    async (language: string) => {
      setError(null);
      try {
        await deleteVoicePack(language);
        onSave({
          ...settings,
          downloadedLanguages: settings.downloadedLanguages.filter((l) => l !== language),
          hiddenLanguages: settings.hiddenLanguages.filter((l) => l !== language),
          supertonicDownloadedVoices: [],
          supertonicVoices: [],
          localTtsLanguage:
            settings.localTtsLanguage === language
              ? (settings.downloadedLanguages.find((l) => l !== language) ?? '')
              : settings.localTtsLanguage,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    },
    [onSave, settings],
  );

  const handleDownloadVoice = useCallback(
    async (voice: string) => {
      setError(null);
      const language = settings.localTtsLanguage || settings.downloadedLanguages[0] || 'en';
      try {
        const response = await sendMessage<MessageResponse<{ jobId: string }>>({
          type: MESSAGE_TYPES.TTS_DOWNLOAD_VOICE,
          payload: { language, voice },
        });
        if (!response.success) {
          throw new Error(response.error ?? t('tts.local.downloadFailed'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [settings.localTtsLanguage, settings.downloadedLanguages],
  );

  const handleDeleteVoice = useCallback(
    async (voice: string) => {
      setError(null);
      try {
        await deleteVoice(voice);
        onSave({
          ...settings,
          supertonicDownloadedVoices: settings.supertonicDownloadedVoices.filter((v) => v !== voice),
          supertonicVoices: settings.supertonicVoices.filter((v) => v !== voice),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [onSave, settings],
  );

  const toggleVoicePick = useCallback(
    (voice: string) => {
      const picked = settings.supertonicVoices;
      if (picked.includes(voice)) {
        onSave({ ...settings, supertonicVoices: picked.filter((v) => v !== voice) });
      } else if (picked.length < SUPERTONIC_MAX_SELECTED_VOICES) {
        onSave({ ...settings, supertonicVoices: [...picked, voice] });
      }
    },
    [onSave, settings],
  );

  const previewVoice = useCallback(
    async (voice: string) => {
      stopExclusiveAudio();
      if (playingVoice === voice) {
        setPlayingVoice(null);
        return;
      }
      setPlayingVoice(voice);
      try {
        const response = await sendMessage<MessageResponse<PronunciationSupertonicTtsResult>>({
          type: MESSAGE_TYPES.PRONUNCIATION_SUPERTONIC_TTS,
          payload: { text: t('tts.testDefault'), langCode: settings.localTtsLanguage, voices: [voice] },
        });
        const bytes = response.success ? response.data?.items?.[0]?.audioBytesB64 : null;
        if (!bytes) throw new Error(response.success ? 'empty' : response.error ?? 'failed');
        const audio = new Audio(URL.createObjectURL(new Blob([decodeBase64ToArrayBuffer(bytes)], { type: 'audio/wav' })));
        const release = claimExclusiveAudio(() => audio.pause());
        audio.onended = () => {
          release();
          setPlayingVoice((p) => (p === voice ? null : p));
        };
        void audio.play();
      } catch (err) {
        setPlayingVoice((p) => (p === voice ? null : p));
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [playingVoice, settings.localTtsLanguage],
  );

  const toggleHidden = useCallback(
    (language: string) => {
      const next = new Set(settings.hiddenLanguages);
      if (next.has(language)) next.delete(language);
      else next.add(language);
      onSave({ ...settings, hiddenLanguages: Array.from(next) });
    },
    [onSave, settings],
  );

  return (
    <SettingsPanel>
      <SettingsGroup>
      <SettingsRow dense title={t('audio.engine.supertonic.enable')} description={t('audio.engine.supertonic.description')}>
        <Toggle
          checked={settings.localTtsEnabled}
          onChange={setLocalTtsEnabled}
          ariaLabel={t('tts.local.aria')}
          dataTestId="local-tts-toggle"
        />
      </SettingsRow>
      </SettingsGroup>

      {settings.localTtsEnabled && (
        <>
          {settings.downloadedLanguages.length > 1 && (
            <SettingsGroup>
            <SettingsRow dense title={t('tts.local.defaultLang')} className={styles.row}>
              <Select
                value={settings.localTtsLanguage}
                options={languageOptions}
                onChange={setLocalTtsLanguage}
                placeholder={t('tts.local.pickLang')}
                data-tihoka-id="local-tts-language-select"
              />
            </SettingsRow>
            </SettingsGroup>
          )}

          <SettingsGroup label={t('tts.local.downloaded')}>

          {settings.downloadedLanguages.length === 0 && visibleJobs.length === 0 && (
            <Text as="p" color="secondary">{t('tts.local.empty')}</Text>
          )}

          {settings.downloadedLanguages.map((language) => {
            const hidden = settings.hiddenLanguages.includes(language);
            return (
              <SettingsRow key={language} dense className={styles.languageRow} title={languageLabel(language)}>
                <div className={styles.languageInfo}>
                  {hidden && (
                    <Chip size="xs" variant="outline" color="muted">
                      {t('tts.local.hidden')}
                    </Chip>
                  )}
                  {activeLanguage === language && (
                    <Chip size="xs" variant="outline" color="warning">
                      {t('tts.local.downloading')}
                    </Chip>
                  )}
                </div>
                <div className={styles.actions}>
                  <Button shape="circle"
                    aria-label={hidden ? t('tts.local.show', [language]) : t('tts.local.hide', [language])}
                    title={hidden ? t('tts.local.showTitle') : t('tts.local.hideTitle')}
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleHidden(language)}
                    data-tihoka-id={`local-tts-hide-${language}`}
                  >
                    <Icon name="eyeOff" />
                  </Button>
                  <Button shape="circle"
                    aria-label={t('tts.local.redownload', [language])}
                    title={t('tts.local.redownloadTitle')}
                    variant="ghost"
                    size="sm"
                    disabled={activeLanguage === language}
                    onClick={() => void handleRedownload(language)}
                    data-tihoka-id={`local-tts-redownload-${language}`}
                  >
                    <Icon name="rotateCcw" />
                  </Button>
                  <Button shape="circle"
                    aria-label={t('tts.local.delete', [language])}
                    title={t('tts.local.deleteTitle')}
                    variant="ghost"
                    size="sm"
                    disabled={activeLanguage === language}
                    onClick={() => void handleDelete(language)}
                    data-tihoka-id={`local-tts-delete-${language}`}
                  >
                    <Icon name="trash" />
                  </Button>
                </div>
              </SettingsRow>
            );
          })}

          {visibleJobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onDismiss={(jobId) => { void dismissJob(jobId).catch(() => undefined); }}
              onRetry={(jobId) => { void retryJob(jobId).catch(() => undefined); }}
            />
          ))}

          <div className={styles.addRow}>
            <Select
              value={selectedAdd}
              options={AVAILABLE_LANGUAGES.filter(
                (o) => !settings.downloadedLanguages.includes(o.value),
              )}
              onChange={setSelectedAdd}
              placeholder={t('tts.local.addLang')}
              data-tihoka-id="local-tts-add-select"
              className={styles.addSelect}
            />
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Icon name="download" />}
              disabled={!selectedAdd || activeLanguage === selectedAdd}
              onClick={() => {
                if (selectedAdd) {
                  void handleDownload(selectedAdd);
                }
              }}
              data-tihoka-id="local-tts-download-btn"
            >
              {t('tts.local.download')}
            </Button>
          </div>

          {error && <Alert variant="error" description={error} />}

          </SettingsGroup>

          {settings.downloadedLanguages.length > 0 && (
            <SettingsGroup label={t('tts.local.voices')}>
              <SettingsRow
                dense
                title={t('tts.local.voices')}
                description={t('tts.local.voices.hint')}
                className={styles.row}
              >
                <Text variant="supporting" color="secondary">
                  {t('audio.voice.count', [settings.supertonicVoices.length])}
                </Text>
              </SettingsRow>

              <ul className={styles.voiceList} data-full={settings.supertonicVoices.length >= SUPERTONIC_MAX_SELECTED_VOICES || undefined}>
                {SUPERTONIC_VOICE_IDS.map((voice) => {
                  const downloaded = settings.supertonicDownloadedVoices.includes(voice);
                  const downloading = downloadingVoices.has(voice);
                  const slot = settings.supertonicVoices.indexOf(voice);
                  const picked = slot >= 0;
                  const label = voiceLabel(voice);
                  return (
                    <li key={voice} className={styles.voiceItem}>
                      {downloaded ? (
                        <Button
                          variant="unstyled"
                          className={`${styles.voiceRow}${picked ? ` ${styles.voiceRowOn}` : ''}`}
                          aria-pressed={picked}
                          onClick={() => toggleVoicePick(voice)}
                          data-tihoka-id={`tts-voice-pick-${voice}`}
                        >
                          <span className={styles.voiceName}>{label}</span>
                          <span className={`${styles.voiceCheck}${picked ? ` ${styles.voiceCheckOn}` : ''}`}>
                            {picked && <span className={styles.voiceNum} key={slot}>{slot + 1}</span>}
                          </span>
                        </Button>
                      ) : (
                        <span className={styles.voiceRow}>
                          <span className={styles.voiceName}>{label}</span>
                          {downloading && (
                            <Chip size="xs" variant="outline" color="warning">
                              {t('tts.local.downloading')}
                            </Chip>
                          )}
                        </span>
                      )}
                      <div className={styles.actions}>
                        {!downloaded && (
                          <Button shape="circle"
                            aria-label={t('tts.local.downloadVoice', [label])}
                            title={t('tts.local.downloadVoice', [label])}
                            variant="ghost"
                            size="sm"
                            disabled={downloading}
                            onClick={() => void handleDownloadVoice(voice)}
                            data-tihoka-id={`tts-voice-download-${voice}`}
                          >
                            <Icon name="download" />
                          </Button>
                        )}
                        {downloaded && (
                          <Button shape="circle"
                            aria-label={t('tts.playVoice', [label])}
                            title={t('tts.playVoice', [label])}
                            variant="ghost"
                            size="sm"
                            onClick={() => void previewVoice(voice)}
                            data-tihoka-id={`tts-voice-play-${voice}`}
                          >
                            <Icon name={playingVoice === voice ? 'pause' : 'play'} />
                          </Button>
                        )}
                        {downloaded && (
                          <Button shape="circle"
                            aria-label={t('tts.local.deleteVoice', [label])}
                            title={t('tts.local.deleteTitle')}
                            variant="ghost"
                            size="sm"
                            disabled={settings.supertonicDownloadedVoices.length === 1}
                            onClick={() => void handleDeleteVoice(voice)}
                            data-tihoka-id={`tts-voice-delete-${voice}`}
                          >
                            <Icon name="trash" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {settings.supertonicVoices.length >= SUPERTONIC_MAX_SELECTED_VOICES && (
                <p className={styles.fullHint} role="status">{t('audio.voice.full')}</p>
              )}
            </SettingsGroup>
          )}
        </>
      )}
    </SettingsPanel>
  );
}
