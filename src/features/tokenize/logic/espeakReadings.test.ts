import { resolveEspeakReadings } from './espeakReadings';
import type { PronunciationEngine, PronunciationResult } from '@/features/pronunciation';

function makeEngine(ipas: Record<string, string>): PronunciationEngine {
  return {
    toPronunciation: jest.fn(async (text: string, language: string) => ({
      text,
      language,
      ipa: ipas[text] ?? '',
      phonemes: [],
      audio: null,
      metadata: { engine: 'espeak-phonemes', engineVersion: '0.0.5', source: 'espeak' },
    }) as PronunciationResult),
  };
}

const NONE = () => undefined;

describe('resolveEspeakReadings', () => {
  it('fills only uncovered terms with slash-wrapped ipa', async () => {
    const engine = makeEngine({ cloud: 'klaʊd' });
    const map = await resolveEspeakReadings(
      'en',
      ['cloud', 'from'],
      (term) => (term === 'from' ? 'frɒm' : undefined),
      engine,
    );

    expect(map.get('cloud')).toBe('/klaʊd/');
    expect(map.has('from')).toBe(false);
    expect(engine.toPronunciation).toHaveBeenCalledTimes(1);
  });

  it('returns empty for non-English profiles', async () => {
    const engine = makeEngine({ kumo: 'kumo' });
    const map = await resolveEspeakReadings('ja', ['kumo'], NONE, engine);

    expect(map.size).toBe(0);
    expect(engine.toPronunciation).not.toHaveBeenCalled();
  });

  it('does not call the engine when every term is covered', async () => {
    const engine = makeEngine({});
    const map = await resolveEspeakReadings('en', ['cloud'], () => 'klaʊd', engine);

    expect(map.size).toBe(0);
    expect(engine.toPronunciation).not.toHaveBeenCalled();
  });

  it('engine failure leaves terms uncovered rather than throwing', async () => {
    const engine: PronunciationEngine = {
      toPronunciation: jest.fn().mockRejectedValue(new Error('wasm dead')),
    };
    const map = await resolveEspeakReadings('en', ['cloud'], NONE, engine);

    expect(map.size).toBe(0);
  });
});
