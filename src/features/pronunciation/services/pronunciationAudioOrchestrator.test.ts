import { PronunciationAudioOrchestrator } from './pronunciationAudioOrchestrator';
import type { AudioItem } from '@/features/dictionaryPopup/types';
import type { PronunciationSettings } from '../types';

class MockProvider {
  constructor(private readonly items: AudioItem[]) {}

  resolve(): Promise<readonly AudioItem[]> {
    return Promise.resolve(this.items);
  }
}

function makeItem(id: string, source: AudioItem['source']): AudioItem {
  return {
    id,
    kind: 'word',
    source,
    label: `${id} · test`,
    state: 'idle',
    defaultSelected: false,
  };
}

function makeSettings(fallbackEngines: PronunciationSettings['fallbackEngines']): PronunciationSettings {
  return {
    fallbackEngines,
    downloadEspeakTtsData: false,
    localFile: {
      packageType: 'single',
      dslFileHandleId: null,
      audioArchiveHandleId: null,
      splitArchiveDirectoryHandleId: null,
      splitArchivePattern: '',
      lastIndexedAt: null,
    },
  };
}

describe('PronunciationAudioOrchestrator', () => {
  it('returns empty array when all providers return empty', async () => {
    const orchestrator = new PronunciationAudioOrchestrator(makeSettings(['localFile', 'native']));
    const result = await orchestrator.resolve('hello', 'en');
    expect(result).toEqual([]);
  });

  it('marks the first item from the first non-empty provider as defaultSelected', async () => {
    const orchestrator = new PronunciationAudioOrchestrator(makeSettings(['localFile', 'native']));
    (orchestrator as unknown as { providers: { resolve: () => Promise<AudioItem[]> }[] }).providers = [
      new MockProvider([]),
      new MockProvider([makeItem('c1', 'community')]),
    ];

    const result = await orchestrator.resolve('hello', 'en');
    expect(result).toHaveLength(1);
    expect(result[0].defaultSelected).toBe(true);
    expect(result[0].id).toBe('c1');
  });

  it('respects the fallback engine order', async () => {
    const orchestrator = new PronunciationAudioOrchestrator(makeSettings(['native', 'localFile']));
    (orchestrator as unknown as { providers: { resolve: () => Promise<AudioItem[]> }[] }).providers = [
      new MockProvider([makeItem('n1', 'community'), makeItem('n2', 'community')]),
      new MockProvider([makeItem('l1', 'local')]),
    ];

    const result = await orchestrator.resolve('hello', 'en');
    expect(result.map((i) => i.id)).toEqual(['n1', 'n2', 'l1']);
    expect(result[0].defaultSelected).toBe(true);
    expect(result[1].defaultSelected).toBe(false);
    expect(result[2].defaultSelected).toBe(false);
  });

  it('skips unknown engine kinds', async () => {
    const orchestrator = new PronunciationAudioOrchestrator(
      makeSettings(['localFile', 'native', 'supertonic', 'browserTts', 'espeak']),
    );
    (orchestrator as unknown as { providers: { resolve: () => Promise<AudioItem[]> }[] }).providers = [
      new MockProvider([makeItem('l1', 'local')]),
    ];

    const result = await orchestrator.resolve('hello', 'en');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('l1');
  });
});
