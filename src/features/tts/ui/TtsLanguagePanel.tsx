import { useState, useEffect, useCallback, useMemo } from 'react';
import { sendMessage, onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { TtsDownloadProgressPayloadSchema } from '@/features/dictionaryPopup/schema';
import { deleteVoicePack } from '@/features/tts/services/ttsDownloadManager';
import { SettingsRow, Toggle, Select, Button, Progress, IconButton, Icon, Label } from '@/shared/ui';
import type { SelectOption } from '@/shared/ui/Select';
import type { TtsSettings } from '@/entities/settings/types';
import type { MessageResponse } from '@/entities/message';
import styles from './TtsLanguagePanel.module.css';

const AVAILABLE_LANGUAGES: readonly SelectOption[] = [
  { value: 'en', label: 'English' },
];

interface TtsLanguagePanelProps {
  readonly settings: TtsSettings;
  readonly onSave: (settings: TtsSettings) => void;
}

export function TtsLanguagePanel({ settings, onSave }: TtsLanguagePanelProps): React.JSX.Element {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [selectedAdd, setSelectedAdd] = useState<string>('');

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

  const onDownloadProgress = useCallback(
    (message: unknown, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: unknown) => void) => {
      const msg = message as { type?: string; payload?: unknown };
      if (msg.type !== MESSAGE_TYPES.TTS_DOWNLOAD_PROGRESS) return false;
      const parsed = TtsDownloadProgressPayloadSchema.safeParse(msg.payload);
      if (parsed.success) {
        setProgress({ loaded: parsed.data.loaded, total: parsed.data.total });
      }
      return false;
    },
    [],
  );

  useEffect(() => {
    onMessage(onDownloadProgress);
    return () => removeOnMessageListener(onDownloadProgress);
  }, [onDownloadProgress]);

  const handleDownload = useCallback(
    async (language: string) => {
      setError(null);
      setDownloading(language);
      setProgress({ loaded: 0, total: 0 });
      try {
        const response = await sendMessage<MessageResponse<boolean>>({
          type: MESSAGE_TYPES.TTS_DOWNLOAD_VOICE,
          payload: { language },
        });
        if (!response.success) {
          throw new Error(response.error ?? 'Tải voice pack thất bại');
        }
        onSave({
          ...settings,
          downloadedLanguages: Array.from(new Set([...settings.downloadedLanguages, language])),
          localTtsLanguage: language,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setDownloading(null);
      }
    },
    [onSave, settings],
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
      <SettingsRow>
        <Label className={styles.rowLabel}>Local TTS (Supertonic v3)</Label>
        <Toggle
          checked={settings.localTtsEnabled}
          onChange={setLocalTtsEnabled}
          ariaLabel="Bật tắt local TTS"
          dataTestId="local-tts-toggle"
        />
      </SettingsRow>

      {settings.localTtsEnabled && (
        <>
          {settings.downloadedLanguages.length > 0 && (
            <SettingsRow className={styles.row}>
              <Label className={styles.rowLabel}>Ngôn ngữ phát mặc định</Label>
              <Select
                value={settings.localTtsLanguage}
                options={languageOptions}
                onChange={setLocalTtsLanguage}
                placeholder="Chọn ngôn ngữ"
                data-cell-id="local-tts-language-select"
              />
            </SettingsRow>
          )}

          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Voice pack đã tải</span>
          </div>

          {settings.downloadedLanguages.length === 0 && (
            <p className={styles.empty}>Chưa có voice pack nào.</p>
          )}

          {settings.downloadedLanguages.map((language) => {
            const hidden = settings.hiddenLanguages.includes(language);
            return (
              <SettingsRow key={language} className={styles.languageRow}>
                <div className={styles.languageInfo}>
                  <span className={styles.languageName}>{language}</span>
                  {hidden && <span className={styles.hiddenBadge}>Ẩn</span>}
                  {downloading === language && (
                    <span className={styles.downloadingBadge}>Đang tải…</span>
                  )}
                </div>
                <div className={styles.actions}>
                  <IconButton material="solid"
                    aria-label={hidden ? `Hiện ${language}` : `Ẩn ${language}`}
                    title={hidden ? 'Hiện' : 'Ẩn'}
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleHidden(language)}
                    data-cell-id={`local-tts-hide-${language}`}
                  >
                    <Icon name="eyeOff" />
                  </IconButton>
                  <IconButton material="solid"
                    aria-label={`Tải lại ${language}`}
                    title="Tải lại"
                    variant="ghost"
                    size="sm"
                    disabled={downloading === language}
                    onClick={() => void handleRedownload(language)}
                    data-cell-id={`local-tts-redownload-${language}`}
                  >
                    <Icon name="rotateCcw" />
                  </IconButton>
                  <IconButton material="solid"
                    aria-label={`Xóa ${language}`}
                    title="Xóa"
                    variant="ghost"
                    size="sm"
                    disabled={downloading === language}
                    onClick={() => void handleDelete(language)}
                    data-cell-id={`local-tts-delete-${language}`}
                  >
                    <Icon name="trash" />
                  </IconButton>
                </div>
              </SettingsRow>
            );
          })}

          {downloading && (
            <div className={styles.progressRow}>
              <Progress value={progress.loaded} max={Math.max(progress.total, 1)} />
              <span className={styles.progressText}>
                {Math.round((progress.loaded / Math.max(progress.total, 1)) * 100)}%
              </span>
            </div>
          )}

          <div className={styles.addRow}>
            <Select
              value={selectedAdd}
              options={AVAILABLE_LANGUAGES.filter(
                (o) => !settings.downloadedLanguages.includes(o.value),
              )}
              onChange={setSelectedAdd}
              placeholder="Thêm ngôn ngữ"
              data-cell-id="local-tts-add-select"
              className={styles.addSelect}
            />
            <Button material="solid"
              variant="primary"
              size="sm"
              leadingIcon={<Icon name="download" />}
              disabled={!selectedAdd || downloading === selectedAdd}
              onClick={() => {
                if (selectedAdd) {
                  void handleDownload(selectedAdd);
                }
              }}
              data-cell-id="local-tts-download-btn"
            >
              Tải
            </Button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </>
      )}
    </div>
  );
}
