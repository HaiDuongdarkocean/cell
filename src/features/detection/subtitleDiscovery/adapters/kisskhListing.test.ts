import { SubtitleDiscoveryPipeline } from '@/features/detection/subtitleDiscovery';
import { createDefaultAdapters } from '@/features/detection/subtitleDiscovery/adapters';
import type { DetectedSubtitle } from '@/entities/media';
import type {
  SubtitleDiscoveryContext,
  SubtitleDiscoveryEnvironment,
} from '@/features/detection/subtitleDiscovery/types';

// Real /api/Sub/<epId> response captured on kisskh.do (E2 evidence).
const KISSKH_LISTING_BODY =
  '[{"src":"https://sub.cdnvideo11.shop/auto-upload/11923/1/2554402f9e051959cf0c643dfcf9a03b.en.srt?v=e76ca4d3-66e5-4d5f-8fcf-3c3b2c341171","label":"English","land":"en","default":true},' +
  '{"src":"https://sub.cdnvideo11.shop/auto-upload/11923/1/2554402f9e051959cf0c643dfcf9a03b.ar.srt?v=1b1ccf58-0944-435a-8b3b-7efaa153a88b","label":"Arabic","land":"ar","default":false},' +
  '{"src":"https://sub.cdnvideo11.shop/auto-upload/11923/1/2554402f9e051959cf0c643dfcf9a03b.km.srt?v=3eb8f36e-7e35-4673-904f-51abf6d118b2","label":"Khmer","land":"km","default":false},' +
  '{"src":"https://sub.cdnvideo11.shop/auto-upload/11923/1/2554402f9e051959cf0c643dfcf9a03b.id.srt?v=c38db18a-3c52-4adf-88f9-4ca67c306ed7","label":"Indonesia","land":"id","default":false},' +
  '{"src":"https://sub.cdnvideo11.shop/auto-upload/11923/1/2554402f9e051959cf0c643dfcf9a03b.ms.srt?v=db0673a1-25f5-4288-9b75-e0de914bc084","label":"Malay","land":"ms","default":false},' +
  '{"src":"https://auto.cdnvideo11.shop/397592/567304f2ac5f78c64b5cb0ae046f8e56.vi.srt","label":"Vietnamese","land":"vi","default":false}]';

function buildEnv(): SubtitleDiscoveryEnvironment {
  return {
    fetchText: async () => ({ ok: false, status: 0, content: '', finalUrl: '' }),
    resolveUrl: (base: string, relative: string) => new URL(relative, base).href,
    now: () => Date.now(),
  } as SubtitleDiscoveryEnvironment;
}

describe('kisskh /api/Sub listing (relative XHR URL)', () => {
  it('yields every caption-list entry as a ready candidate', async () => {
    const added: DetectedSubtitle[] = [];
    const pipeline = new SubtitleDiscoveryPipeline({
      add: (subs) => {
        added.push(...subs);
        return subs.length;
      },
    });
    for (const adapter of createDefaultAdapters()) {
      pipeline.register(adapter);
    }

    const signal = {
      kind: 'network-response' as const,
      url: '/api/Sub/207851?kkey=049F2FB1D9A315803E9A4E5D5244D30E2497D15B80043E71E036B1A1653E1300CF1BBC4D',
      body: KISSKH_LISTING_BODY,
      tabId: 1,
      frameId: 0,
      initiator: 'https://kisskh.do',
      method: 'GET',
      type: 'xmlhttprequest',
    };
    const context: SubtitleDiscoveryContext = {
      tabId: 1,
      frameId: 0,
      origin: 'https://kisskh.do',
      initiator: 'https://kisskh.do',
      timestamp: Date.now(),
    };

    const result = await pipeline.process(signal, context, buildEnv());

    expect(result.stats.ready).toBe(6);
    expect(added.map((s) => s.language)).toEqual(['en', 'ar', 'km', 'id', 'ms', 'vi']);
    expect(added.every((s) => s.url.startsWith('https://'))).toBe(true);
    expect(added.every((s) => s.tabId === 1)).toBe(true);
  });
});
