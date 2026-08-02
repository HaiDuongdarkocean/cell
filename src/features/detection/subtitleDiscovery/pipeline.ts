// Generic subtitle discovery pipeline.
//
// Orchestrates the protocol-oriented flow:
//   signal → adapter match → discover → validate/normalize → dedup → inventory
//
// No site-specific branches. All adapter behavior is registered via the
// SubtitleDiscoveryAdapter interface.

import type { DetectedSubtitle } from '@/entities/media';
import { subtitleSignalSchema } from './schema';
import type {
  SubtitleCandidate,
  SubtitleDiscoveryAdapter,
  SubtitleDiscoveryContext,
  SubtitleDiscoveryEnvironment,
  SubtitleDiscoveryResult,
  SubtitleInventorySink,
  SubtitlePipelineStats,
} from './types';

const MAX_CANDIDATES = 500;

export class SubtitleDiscoveryPipeline {
  private readonly adapters: SubtitleDiscoveryAdapter[] = [];
  private readonly dedupByTab: Map<number, Map<string, SubtitleCandidate>> = new Map();
  private readonly sink: SubtitleInventorySink;

  constructor(sink: SubtitleInventorySink) {
    this.sink = sink;
  }

  register(adapter: SubtitleDiscoveryAdapter): void {
    this.adapters.push(adapter);
    this.adapters.sort((a, b) => a.priority - b.priority);
  }

  matchesNetworkUrl(url: string): boolean {
    const signal = { kind: 'network-response' as const, url, body: '', tabId: 0, frameId: 0 };
    return this.adapters.some((a) => a.match(signal));
  }

  async process(
    rawSignal: unknown,
    context: SubtitleDiscoveryContext,
    env: SubtitleDiscoveryEnvironment,
  ): Promise<SubtitleDiscoveryResult & { stats: SubtitlePipelineStats }> {
    const parsed = subtitleSignalSchema.safeParse(rawSignal);
    if (!parsed.success) {
      return {
        ready: [],
        unresolved: [],
        rejected: [],
        stats: { processed: 0, ready: 0, unresolved: 0, rejected: 0, duplicate: 0 },
      };
    }

    const signal = parsed.data;
    const matching = this.adapters.filter((a) => a.match(signal));

    const result = {
      ready: [] as SubtitleCandidate[],
      unresolved: [] as SubtitleCandidate[],
      rejected: [] as SubtitleCandidate[],
    };

    const allCandidates: SubtitleCandidate[] = [];

    await Promise.all(
      matching.map(async (adapter) => {
        try {
          const discovered = await adapter.discover(signal, context, env);
          for (const c of discovered.slice(0, MAX_CANDIDATES)) {
            allCandidates.push(this.normalizeCandidate(c, context, env));
          }
        } catch (err) {
          // Adapter failure is isolated; other adapters and existing candidates continue.
          console.warn(`[subtitle-discovery] adapter ${adapter.id} failed:`, err instanceof Error ? err.message : String(err));
        }
      }),
    );

    const tabDedup = this.getTabDedup(context.tabId);
    let duplicate = 0;

    for (const c of allCandidates) {
      if (c.status === 'rejected') {
        result.rejected = [...result.rejected, c];
        continue;
      }

      if (tabDedup.has(c.identity)) {
        duplicate++;
        continue;
      }

      tabDedup.set(c.identity, c);

      if (c.status === 'ready') {
        result.ready = [...result.ready, c];
      } else {
        result.unresolved = [...result.unresolved, c];
      }
    }

    const readySubtitles = result.ready.map((c) => this.toDetectedSubtitle(c, env));
    this.sink.add(readySubtitles);
    this.sink.addUnresolved?.(result.unresolved);

    return {
      ...result,
      stats: {
        processed: allCandidates.length,
        ready: result.ready.length,
        unresolved: result.unresolved.length,
        rejected: result.rejected.length,
        duplicate,
      },
    };
  }

  clearTab(tabId: number): void {
    this.dedupByTab.delete(tabId);
  }

  private getTabDedup(tabId: number): Map<string, SubtitleCandidate> {
    let map = this.dedupByTab.get(tabId);
    if (!map) {
      map = new Map();
      this.dedupByTab.set(tabId, map);
    }
    return map;
  }

  private normalizeCandidate(
    c: SubtitleCandidate,
    ctx: SubtitleDiscoveryContext,
    env: SubtitleDiscoveryEnvironment,
  ): SubtitleCandidate {
    if (c.status === 'rejected' || c.status === 'unresolved') {
      return c;
    }

    let url = c.url;
    if (c.source === 'relative' && c.baseUrl && url) {
      url = env.resolveUrl(c.baseUrl, url);
    } else if (c.source === 'relative' && !c.baseUrl) {
      const base = ctx.frameUrl ?? ctx.tabUrl ?? c.replayContext.origin;
      url = base ? env.resolveUrl(base, url ?? '') : url;
    }

    const isHttp = url ? /^https?:\/\//i.test(url) : false;
    if (url && !isHttp) {
      return {
        ...c,
        status: 'rejected',
        rejectReason: `non-http(s) URL: ${url}`,
      };
    }

    return {
      ...c,
      url,
      replayContext: {
        ...c.replayContext,
        referer: c.replayContext.referer ?? ctx.initiator ?? ctx.frameUrl ?? c.replayContext.origin,
      },
    };
  }

  private toDetectedSubtitle(
    c: SubtitleCandidate,
    env: SubtitleDiscoveryEnvironment,
  ): DetectedSubtitle {
    if (!c.url) {
      throw new Error(`Cannot convert unresolved candidate ${c.id} to DetectedSubtitle`);
    }
    return {
      id: c.id,
      url: c.url,
      format: c.format,
      language: c.language,
      tabId: c.tabId,
      detectedAt: env.now(),
      displayName: c.label,
      isAsr: c.asr,
      initiator: c.initiator,
      frameId: c.frameId,
    };
  }
}
