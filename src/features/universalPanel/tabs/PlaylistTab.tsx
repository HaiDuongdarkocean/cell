import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';
import { Text } from '@/shared/ui/Text';
import { t, type MessageKey } from '@/shared/i18n';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { decodeBase64ToArrayBuffer } from '@/shared/lib/base64';
import { formatBytes } from '@/shared/lib/formatBytes';
import { formatDuration } from '@/features/reader';
import type {
  CondenseAudioEventPayload,
  CondenseAudioReadResult,
  MessageResponse,
} from '@/entities/message';
import type {
  CondensedAudioErrorReason,
  CondensedAudioRecord,
  CondensedAudioStatus,
} from '@/entities/condensedAudio';
import styles from './PlaylistTab.module.css';

const READ_CHUNK = 4 * 1024 * 1024;

const STATUS_LABEL: Record<CondensedAudioStatus, MessageKey> = {
  processing: 'condensedAudio.status.processing',
  recording: 'condensedAudio.status.recording',
  finalizing: 'condensedAudio.status.finalizing',
  ready: 'condensedAudio.status.ready',
  failed: 'condensedAudio.status.failed',
  missing: 'condensedAudio.status.missing',
};

const ERROR_LABEL: Record<CondensedAudioErrorReason, MessageKey> = {
  'no-cues': 'condensedAudio.error.noCues',
  'no-source': 'condensedAudio.error.noSource',
  'capture-blocked': 'condensedAudio.error.captureBlocked',
  'encode-failed': 'condensedAudio.error.encodeFailed',
  'export-failed': 'condensedAudio.error.exportFailed',
  'drive-failed': 'condensedAudio.error.driveFailed',
  cancelled: 'condensedAudio.error.cancelled',
  interrupted: 'condensedAudio.error.interrupted',
  'input-missing': 'condensedAudio.error.inputMissing',
  'io-failed': 'condensedAudio.error.ioFailed',
};

function extOf(record: CondensedAudioRecord): string {
  if (record.mimeType.includes('mp4')) return 'M4A';
  if (record.mimeType.includes('ogg')) return 'OPUS';
  return 'MP3';
}

function metaLine(record: CondensedAudioRecord): string {
  const parts = [
    formatDuration(Math.round(record.durationMs / 1000)),
    record.sizeBytes > 0 ? formatBytes(record.sizeBytes) : null,
    extOf(record),
    record.driveSyncedAt ? t('condensedAudio.meta.driveSynced') : null,
    t(STATUS_LABEL[record.status]),
  ];
  return parts.filter(Boolean).join(' · ');
}

function StatusLead({ record }: { record: CondensedAudioRecord }): React.JSX.Element {
  if (record.status === 'processing' || record.status === 'recording' || record.status === 'finalizing') {
    return <Spinner size="sm" ariaLabel={t(STATUS_LABEL[record.status])} />;
  }
  if (record.status === 'ready') {
    return <Icon name="check" size="sm" className={styles.iconOk} />;
  }
  if (record.status === 'failed') {
    return <Icon name="alertCircle" size="sm" className={styles.iconErr} />;
  }
  return <Icon name="info" size="sm" className={styles.iconDim} />;
}

async function send<T>(type: string, payload: unknown): Promise<MessageResponse<T> | undefined> {
  return sendMessage<MessageResponse<T>>({ type, payload });
}

export function PlaylistTab(): React.JSX.Element {
  const [records, setRecords] = useState<readonly CondensedAudioRecord[] | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const res = await send<CondensedAudioRecord[]>(MESSAGE_TYPES.CONDENSE_AUDIO_LIST, {});
    if (res?.success && res.data) setRecords(res.data);
  }, []);

  useEffect(() => {
    void refresh();
    const listener = (msg: unknown): void => {
      const request = msg as { type?: string; payload?: CondenseAudioEventPayload };
      if (request?.type === MESSAGE_TYPES.CONDENSE_AUDIO_EVENT) void refresh();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [refresh]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const setPreview = useCallback((id: string | null, url: string | null): void => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewId(id);
    setPreviewUrl(url);
  }, []);

  const onPreview = useCallback(
    async (record: CondensedAudioRecord): Promise<void> => {
      if (previewId === record.id) {
        setPreview(null, null);
        return;
      }
      setBusyId(record.id);
      try {
        const parts: ArrayBuffer[] = [];
        let offset = 0;
        for (;;) {
          const res = await send<CondenseAudioReadResult>(MESSAGE_TYPES.CONDENSE_AUDIO_READ, {
            id: record.id,
            offset,
            length: READ_CHUNK,
          });
          if (!res?.success || !res.data) return;
          const buf = decodeBase64ToArrayBuffer(res.data.dataBase64);
          if (buf.byteLength > 0) parts.push(buf);
          offset += buf.byteLength;
          if (res.data.done || buf.byteLength === 0) break;
        }
        if (parts.length === 0) return;
        const blob = new Blob(parts, { type: record.mimeType });
        setPreview(record.id, URL.createObjectURL(blob));
      } finally {
        setBusyId(null);
      }
    },
    [previewId, setPreview],
  );

  const act = useCallback(
    async (type: string, record: CondensedAudioRecord): Promise<void> => {
      setBusyId(record.id);
      try {
        await send(type, { id: record.id });
        await refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  if (records === null) {
    return (
      <div className={styles.empty} role="status">
        <Spinner size="md" ariaLabel={t('condensedAudio.status.processing')} />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon name="audioWave" size="md" className={styles.iconDim} />
        <Text variant="body" color="secondary">
          {t('condensedAudio.list.emptyTitle')}
        </Text>
        <Text variant="supporting" color="secondary">
          {t('condensedAudio.list.emptyHint')}
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.list} role="list" aria-label={t('panel.tab.playlist')}>
      {records.map((record) => {
        const busy = busyId === record.id;
        const active =
          record.status === 'processing' ||
          record.status === 'recording' ||
          record.status === 'finalizing';
        return (
          <Card
            key={record.id}
            className={`${styles.itemRow} ${record.status === 'failed' ? styles.itemError : ''}`}
            role="listitem"
            aria-live="polite"
          >
            <div className={styles.itemInner}>
              <span className={styles.itemLead}>
                <StatusLead record={record} />
              </span>
              <div className={styles.itemBody}>
                <Text variant="body" truncate>
                  {record.title}
                </Text>
                <Text as="p" variant="supporting" color="secondary">
                  {metaLine(record)}
                </Text>
                {record.status === 'failed' && record.error && (
                  <Text as="p" variant="supporting" className={styles.errorText}>
                    {t(ERROR_LABEL[record.error])}
                  </Text>
                )}
                {previewId === record.id && previewUrl && (
                  <audio
                    className={styles.preview}
                    src={previewUrl}
                    controls
                    autoPlay
                    data-cell-id={`playlist-preview-${record.id}`}
                  />
                )}
              </div>
              <span className={styles.itemActions}>
                {record.status === 'ready' && (
                  <>
                    <Button
                      variant="ghost"
                      size="md"
                      shape="circle"
                      aria-label={t('condensedAudio.action.preview')}
                      title={t('condensedAudio.action.preview')}
                      disabled={busy}
                      data-cell-id={`playlist-preview-btn-${record.id}`}
                      onClick={() => void onPreview(record)}
                    >
                      <Icon name={previewId === record.id ? 'x' : 'play'} size="sm" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      shape="circle"
                      aria-label={t('condensedAudio.action.export')}
                      title={t('condensedAudio.action.export')}
                      disabled={busy}
                      data-cell-id={`playlist-export-${record.id}`}
                      onClick={() => void act(MESSAGE_TYPES.CONDENSE_AUDIO_EXPORT, record)}
                    >
                      <Icon name="download" size="sm" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      shape="circle"
                      aria-label={t('condensedAudio.action.syncDrive')}
                      title={t('condensedAudio.action.syncDrive')}
                      disabled={busy || record.driveSyncedAt !== null}
                      data-cell-id={`playlist-sync-${record.id}`}
                      onClick={() => void act(MESSAGE_TYPES.CONDENSE_AUDIO_SYNC_DRIVE, record)}
                    >
                      <Icon name="navRepeat" size="sm" />
                    </Button>
                  </>
                )}
                {record.status === 'failed' && (
                  <Button
                    variant="ghost"
                    size="md"
                    shape="circle"
                    aria-label={t('condensedAudio.action.retry')}
                    title={t('condensedAudio.action.retry')}
                    disabled={busy}
                    data-cell-id={`playlist-retry-${record.id}`}
                    onClick={() => void act(MESSAGE_TYPES.CONDENSE_AUDIO_RETRY, record)}
                  >
                    <Icon name="rotateCcw" size="sm" />
                  </Button>
                )}
                {(active || record.status === 'missing' || record.status === 'failed') && (
                  <Button
                    variant="ghost"
                    size="md"
                    shape="circle"
                    aria-label={active ? t('condensedAudio.action.cancel') : t('condensedAudio.action.delete')}
                    title={active ? t('condensedAudio.action.cancel') : t('condensedAudio.action.delete')}
                    disabled={busy}
                    data-cell-id={`playlist-delete-${record.id}`}
                    onClick={() =>
                      void act(
                        active
                          ? MESSAGE_TYPES.CONDENSE_AUDIO_CANCEL
                          : MESSAGE_TYPES.CONDENSE_AUDIO_DELETE,
                        record,
                      )
                    }
                  >
                    <Icon name={active ? 'x' : 'trash'} size="sm" />
                  </Button>
                )}
                {record.status === 'ready' && (
                  <Button
                    variant="ghost"
                    size="md"
                    shape="circle"
                    aria-label={t('condensedAudio.action.delete')}
                    title={t('condensedAudio.action.delete')}
                    disabled={busy}
                    data-cell-id={`playlist-delete-${record.id}`}
                    onClick={() => void act(MESSAGE_TYPES.CONDENSE_AUDIO_DELETE, record)}
                  >
                    <Icon name="trash" size="sm" />
                  </Button>
                )}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
