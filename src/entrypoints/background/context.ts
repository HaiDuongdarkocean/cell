/**
 * Background service context — shared state + building blocks + helpers
 * passed to handler modules and wireEvents.
 *
 * `BackgroundService` implements this interface. Each handler group file
 * exports a `register(ctx)` function that registers message handlers on
 * `ctx.messageBus`. Helper functions in `helpers.ts` take this interface
 * as their first parameter.
 */
import type { NetworkInterceptor } from './networkInterceptor';
import type { MessageBus } from './messageBus';
import type { DownloadQueue } from '@/features/download';
import type { Downloader } from '@/features/download';
import type { OffscreenManager } from './offscreenManager';
import type { MessageHandler } from '@/entities/message';
import type { SubtitleDiscoveryService } from './subtitleDiscoveryService';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  Settings,
  MediaType,
  BilingualCue,
} from '@/entities/media';

export interface BackgroundContext {
  // --- building blocks ---
  readonly networkInterceptor: NetworkInterceptor;
  readonly messageBus: MessageBus;
  readonly downloadQueue: DownloadQueue;
  readonly downloader: Downloader;
  readonly offscreenManager: OffscreenManager;
  readonly subtitleDiscoveryService: SubtitleDiscoveryService;

  // --- mutable shared state ---
  /** Maps a download id to the detected media it was created from. */
  readonly mediaMap: Map<string, DetectedVideo | DetectedSubtitle>;
  /** Per-tab auto-download state (url + enqueued ids). */
  readonly autoDownloadedTabs: Map<number, { url: string; enqueuedIds: Set<string> }>;
  /** Last bilingual cues relayed via SUBTITLE_CUES_LOADED, keyed by tabId. */
  readonly lastCuesByTab: Map<number, BilingualCue[]>;
  /** Active content tab id for side-panel relay filtering (ADR-011 v3). */
  activeTabIdForPanel: number | undefined;
  /** Cached active-state flag mirrored from storage. */
  extensionActive: boolean;
  /** Resolves when session media + downloads have been restored. */
  sessionReady: Promise<void>;

  // --- handler registration ---
  on(type: string, handler: MessageHandler): void;

  // --- tab helpers ---
  getActiveTabId(): Promise<number | undefined>;
  reloadActiveTab(): Promise<void>;

  // --- badge helpers ---
  updateBadgeForTab(tabId: number): void;
  updateBadgeForActiveTab(): Promise<void>;
  clearBadge(): void;

  // --- media enrichment helpers ---
  enrichVideo(video: DetectedVideo): DetectedVideo;
  enrichM3u8Variants(video: DetectedVideo): void;
  findVideoById(videoId: string): Promise<DetectedVideo | undefined>;
  findSubtitleById(subtitleId: string): Promise<DetectedSubtitle | undefined>;
  findAllVideos(): DetectedVideo[];
  findAllSubtitles(): DetectedSubtitle[];

  // --- download item helper ---
  createDownloadItem(
    media: DetectedVideo | DetectedSubtitle,
    mediaType: MediaType,
  ): DownloadItem;

  // --- settings helpers ---
  loadSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  loadExtensionStatus(): Promise<boolean>;
  saveExtensionStatus(active: boolean): Promise<void>;

  // --- session persistence helpers ---
  performSessionRestore(): Promise<void>;
  saveSessionMedia(
    tabId: number,
    videos: DetectedVideo[],
    subtitles: DetectedSubtitle[],
  ): void;
  loadSessionMedia(): Promise<void>;
  clearSessionMedia(tabId: number): void;
  saveSessionDownloads(tabId: number): void;
  loadSessionDownloads(): Promise<void>;
  clearSessionDownloads(tabId: number): void;

  // --- subtitle helpers ---
  pushAutoLoadSubtitles(
    tabId: number,
    subtitles: DetectedSubtitle[],
  ): Promise<void>;
  resolveUnknownSubtitleLanguages(
    tabId: number,
    subtitles: DetectedSubtitle[],
  ): Promise<DetectedSubtitle[]>;
  extractOrigin(tabUrl: string): string;

  // --- auto-download helper ---
  maybeAutoDownload(tabId: number): Promise<void>;
}
