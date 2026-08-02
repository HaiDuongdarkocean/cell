// Subtitle-list discovery service — wires the generic discovery pipeline to the
// background's network interceptor, offscreen fetch, and DNR referer rewrite.

import {
  SubtitleDiscoveryPipeline,
  createDefaultAdapters,
  createFetchText,
  resolveRelativeUrl,
  type SubtitleDiscoveryContext,
  type SubtitleSignal,
  type SubtitleCandidate,
} from '@/features/detection/subtitleDiscovery';
import { setRefererRule, removeRefererRule } from '@/shared/lib/chrome-apis/declarativeNetRequest';
import { offscreenFetch } from './offscreenFetch';
import { resolveStremioSubtitleListing } from './helpers';
import { isStremioSubtitleListing } from '@/features/detection';
import type { BackgroundContext } from './context';

/**
 * Service-owned pipeline sink. It adds ready DetectedSubtitle records to the
 * network interceptor and stores unresolved handles for diagnostics.
 */
function createSink(ctx: BackgroundContext) {
  const unresolvedByTab = new Map<number, SubtitleCandidate[]>();
  return {
    add: (subs: readonly import('@/entities/media').DetectedSubtitle[]) =>
      ctx.networkInterceptor.addDetectedSubtitles(subs),
    addUnresolved: (candidates: readonly SubtitleCandidate[]) => {
      if (candidates.length === 0) return;
      const tabId = candidates[0].tabId;
      const list = unresolvedByTab.get(tabId) ?? [];
      unresolvedByTab.set(tabId, list.concat(candidates));
    },
  };
}

export class SubtitleDiscoveryService {
  readonly pipeline: SubtitleDiscoveryPipeline;
  private readonly ctx: BackgroundContext;

  constructor(ctx: BackgroundContext) {
    this.ctx = ctx;
    this.pipeline = new SubtitleDiscoveryPipeline(createSink(ctx));
    for (const adapter of createDefaultAdapters()) {
      this.pipeline.register(adapter);
    }
  }

  isListingUrl(url: string): boolean {
    if (this.isMediaFileUrl(url)) return false;
    return this.pipeline.matchesNetworkUrl(url) || isStremioSubtitleListing(url);
  }

  async resolveListing(url: string, tabId: number, initiator?: string): Promise<void> {
    if (this.isMediaFileUrl(url)) return;

    if (this.pipeline.matchesNetworkUrl(url)) {
      const signal = this.buildNetworkSignal(url, tabId, initiator);
      const context = this.buildContext(url, tabId, 0, initiator);
      const env = this.buildEnv();
      await this.pipeline.process(signal, context, env);
      return;
    }

    if (isStremioSubtitleListing(url)) {
      await resolveStremioSubtitleListing(this.ctx, url, tabId, initiator);
    }
  }

  async processSignal(signal: SubtitleSignal, tabId: number, frameId: number, initiator?: string): Promise<void> {
    const url = this.signalUrl(signal);
    const context = this.buildContext(url, tabId, frameId, initiator);
    const env = this.buildEnv();
    await this.pipeline.process(signal, context, env);
  }

  clearTab(tabId: number): void {
    this.pipeline.clearTab(tabId);
  }

  private buildNetworkSignal(
    url: string,
    tabId: number,
    initiator?: string,
  ): SubtitleSignal {
    return {
      kind: 'network-response',
      url,
      body: '',
      tabId,
      frameId: 0,
      initiator,
      method: 'GET',
      type: 'xmlhttprequest',
    };
  }

  private buildContext(
    url: string,
    tabId: number,
    frameId: number,
    initiator?: string,
  ): SubtitleDiscoveryContext {
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      origin = '';
    }
    return {
      tabId,
      frameId,
      origin: initiator ?? origin,
      initiator,
      timestamp: Date.now(),
    };
  }

  private buildEnv() {
    const fetcher = (url: string, options?: { headers?: Record<string, string>; credentials?: RequestCredentials }) =>
      offscreenFetch(this.ctx.offscreenManager, url, options);

    return {
      fetchText: createFetchText({
        fetcher,
        setRefererRule,
        removeRefererRule,
      }),
      resolveUrl: (base: string, relative: string) => resolveRelativeUrl(base, relative),
      now: () => Date.now(),
    };
  }

  private signalUrl(signal: SubtitleSignal): string {
    switch (signal.kind) {
      case 'network-response':
        return signal.url;
      case 'frame-source':
        return signal.frameUrl;
      case 'player-state':
        return signal.origin;
      case 'document-html':
        return signal.url;
      case 'hls-playlist':
        return signal.url;
    }
  }

  /**
   * Exclude direct media files from the network-interceptor listing path.
   * These are captured with their bodies by the content-script fetch bridge;
   * re-fetching them from the background would double traffic and often fail
   * due to auth token / Referer requirements.
   */
  private isMediaFileUrl(url: string): boolean {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      return /\.(m3u8|mpd|mp4|ts|vtt|srt|ass|ssa|ttml)$/i.test(pathname);
    } catch {
      return false;
    }
  }
}
