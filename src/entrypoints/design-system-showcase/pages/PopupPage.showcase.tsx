import { useState, type ReactElement } from 'react';
import { Tabs, Button } from '@/shared/ui';
import { Header } from '@/entrypoints/popup/components/layout/Header';
import { VideoCard } from '@/entrypoints/popup/components/media/VideoCard';
import { SubtitleCard } from '@/entrypoints/popup/components/media/SubtitleCard';
import { DownloadCard } from '@/entrypoints/popup/components/media/DownloadCard';
import { MediaEmpty } from '@/entrypoints/popup/components/media/MediaEmpty';
import type { DetectedVideo, DetectedSubtitle, DownloadItem } from '@/entities/media';
import styles from './PopupPage.module.css';

const MOCK_VIDEO: DetectedVideo = {
  id: 'v1',
  url: 'https://example.com/video/master.m3u8',
  format: 'm3u8',
  title: 'Machine Learning Algorithms — Full Course',
  tabId: 1,
  tabUrl: 'https://www.youtube.com/watch?v=demo',
  detectedAt: Date.now(),
  variants: [
    { url: 'https://example.com/video/1080p.m3u8', quality: '1080p', resolution: '1920x1080', bandwidth: 5000000, size: 250000000 },
    { url: 'https://example.com/video/720p.m3u8', quality: '720p', resolution: '1280x720', bandwidth: 2500000, size: 120000000 },
    { url: 'https://example.com/video/480p.m3u8', quality: '480p', resolution: '854x480', bandwidth: 1000000, size: 50000000 },
  ],
};

const MOCK_SUBTITLE: DetectedSubtitle = {
  id: 's1',
  url: 'https://example.com/subtitles/en.vtt',
  format: 'vtt',
  language: 'en',
  tabId: 1,
  detectedAt: Date.now(),
  size: 24576,
  isAsr: true,
  displayName: 'English (auto-generated)',
};

const MOCK_DOWNLOAD: DownloadItem = {
  id: 'd1',
  mediaType: 'video',
  url: 'https://example.com/video/1080p.m3u8',
  title: 'Machine Learning Algorithms — Full Course',
  tabId: 1,
  status: 'downloading',
  progress: 45,
  quality: '1080p',
  downloadProgress: 45,
  startedAt: Date.now() - 30000,
};

export function Showcase(): ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloads] = useState<DownloadItem[]>([MOCK_DOWNLOAD]);

  const handleToggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.popupFrame}>
        <Header
          isActive
          onToggleExtension={() => {}}
          isAutoDownloadActive={false}
          onToggleAutoDownload={() => {}}
          onToggleTheme={() => {}}
          onOpenSettings={() => {}}
          currentTheme="light"
        />
        <main className={styles.content}>
          <Tabs defaultValue="media">
            <Tabs.List className={styles.tabList}>
              <Tabs.Trigger value="media" className={styles.tabTrigger}>Media</Tabs.Trigger>
              <Tabs.Trigger value="downloads" className={styles.tabTrigger}>
                Downloads
                {downloads.length > 0 && <span className={styles.tabBadge}>{downloads.length}</span>}
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="media" className={styles.tabContent}>
              <div className={styles.actionsRow}>
                <Button variant="link" size="sm">Select All</Button>
                <Button variant="link" size="sm">Download All</Button>
              </div>
              <div className={styles.mediaList} role="list">
                <VideoCard
                  video={MOCK_VIDEO}
                  displayTitle={MOCK_VIDEO.title}
                  selected={selectedIds.has(MOCK_VIDEO.id)}
                  downloading={false}
                  onToggleSelect={handleToggleSelect}
                  onDownload={() => {}}
                  onSelectQuality={() => {}}
                />
                <SubtitleCard
                  subtitle={MOCK_SUBTITLE}
                  displayTitle="English (auto-generated)"
                  languageLabel="English"
                  selected={selectedIds.has(MOCK_SUBTITLE.id)}
                  downloading={false}
                  onToggleSelect={handleToggleSelect}
                  onDownload={() => {}}
                />
              </div>
            </Tabs.Content>

            <Tabs.Content value="downloads" className={styles.tabContent}>
              <div className={styles.mediaList}>
                {downloads.map((d) => (
                  <DownloadCard
                    key={d.id}
                    download={d}
                    onPause={() => {}}
                    onResume={() => {}}
                    onCancel={() => {}}
                    onRetry={() => {}}
                    onRemove={() => {}}
                  />
                ))}
                {downloads.length === 0 && <MediaEmpty type="downloads" />}
              </div>
            </Tabs.Content>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Popup Page',
  description: 'Extension popup with Header (extension toggle, theme, auto-download, settings), Media tab (video + subtitle cards with quality select), and Downloads tab (progress, cancel/resume/retry).',
  level: 'pages' as const,
  category: 'Popup',
  order: 20,
};
