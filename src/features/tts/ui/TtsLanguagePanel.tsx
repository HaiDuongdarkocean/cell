import { useState, useCallback, useMemo } from 'react';
import { t } from '@/shared/i18n';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { deleteVoicePack } from '@/features/tts/services/ttsDownloadManager';
import { SettingsRow, SettingsGroup, Toggle, Select, Button, Icon } from '@/shared/ui';
import type { SelectOption } from '@/shared/ui/Select';
import type { TtsSettings } from '@/entities/settings/types';
import type { MessageResponse } from '@/entities/message';


import { JobRow, useJobs, dismissJob, retryJob } from '@/features/jobs';
import { isActiveJob } from '@/entities/job/types';
import styles from './TtsLanguagePanel.module.css';

const AVAILABLE_LANGUAGES: readonly SelectOption[] = [
  { value: 'en', label: 'English' },
];

interface TtsLanguagePanelProps {
  readonly settings: TtsSettings;
  readonly onSave: (settings: TtsSettings) => void;
}

export function TtsLanguagePanel({ settings, onSave }: TtsLanguagePanelProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [selectedAdd, setSelectedAdd] = useState<string>('');

  // The background JobRegistry owns downloads — the panel observes jobs and
  // the completion effect (downloadedLanguages/localTtsLanguage) lands via
  // the settings subscription, never from this mortal surface.
  const voiceJobs = useJobs('voice-download');
  const activeLanguage = useMemo(() => {
    const active = voiceJobs.find((j) => isActiveJob(j));
    return typeof active?.params.language === 'string' ? active.params.language : null;
  }, [voiceJobs]);

  const languageOptions = useMemo(
    () => settings.downloadedLanguages.map((lang) => ({ value: lang, label: lang })),
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
    <div className={styles.panel}>
      <SettingsRow dense title={t('tts.local.label')}>
        <Toggle
          checked={settings.localTtsEnabled}
          onChange={setLocalTtsEnabled}
          ariaLabel={t('tts.local.aria')}
          dataTestId="local-tts-toggle"
        />
      </SettingsRow>

      {settings.localTtsEnabled && (
        <>
          {settings.downloadedLanguages.length > 0 && (
            <SettingsRow dense title={t('tts.local.defaultLang')} className={styles.row}>
              <Select
                value={settings.localTtsLanguage}
                options={languageOptions}
                onChange={setLocalTtsLanguage}
                placeholder={t('tts.local.pickLang')}
                data-cell-id="local-tts-language-select"
              />
            </SettingsRow>
          )}

          <SettingsGroup label={t('tts.local.downloaded')} className={styles.sectionHeader}>

          {settings.downloadedLanguages.length === 0 && voiceJobs.length === 0 && (
            <p className={styles.empty}>{t('tts.local.empty')}</p>
          )}

          {settings.downloadedLanguages.map((language) => {
            const hidden = settings.hiddenLanguages.includes(language);
            return (
              <SettingsRow key={language} dense className={styles.languageRow}>
                <div className={styles.languageInfo}>
                  <span className={styles.languageName}>{language}</span>
                  {hidden && <span className={styles.hiddenBadge}>{t('tts.local.hidden')}</span>}
                  {activeLanguage === language && (
                    <span className={styles.downloadingBadge}>{t('tts.local.downloading')}</span>
                  )}
                </div>
                <div className={styles.actions}>
                  <Button shape="circle"
                    aria-label={hidden ? t('tts.local.show', [language]) : t('tts.local.hide', [language])}
                    title={hidden ? t('tts.local.showTitle') : t('tts.local.hideTitle')}
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleHidden(language)}
                    data-cell-id={`local-tts-hide-${language}`}
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
                    data-cell-id={`local-tts-redownload-${language}`}
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
                    data-cell-id={`local-tts-delete-${language}`}
                  >
                    <Icon name="trash" />
                  </Button>
                </div>
              </SettingsRow>
            );
          })}

          {voiceJobs.map((job) => (
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
              data-cell-id="local-tts-add-select"
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
              data-cell-id="local-tts-download-btn"
            >
              {t('tts.local.download')}
            </Button>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          </SettingsGroup>
        </>
      )}
    </div>
  );
}
