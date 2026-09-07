import {
  getOutputModeChain,
  getEngineStatus,
  OUTPUT_MODES,
} from './outputMode';
import type { PronunciationSettings, TtsSettings } from '@/entities/settings/types';

function makePronunciationSettings(overrides?: Partial<PronunciationSettings>): PronunciationSettings {
  return {
    fallbackEngines: ['localFile', 'native', 'supertonic', 'browserTts', 'espeak'],
    downloadEspeakTtsData: false,
    localFile: {
      packageType: 'single',
      dslFileHandleId: null,
      audioArchiveHandleId: null,
      splitArchiveDirectoryHandleId: null,
      splitArchivePattern: '',
      lastIndexedAt: null,
    },
    ...overrides,
  };
}

function makeTtsSettings(overrides?: Partial<TtsSettings>): TtsSettings {
  return {
    enabled: true,
    savedVoices: [],
    voices: [],
    maxDisplay: 3,
    autoplayCount: 0,
    preferredAccent: 'US',
    localTtsEnabled: false,
    localTtsLanguage: 'en',
    downloadedLanguages: [],
    hiddenLanguages: [],
    ...overrides,
  };
}

describe('OUTPUT_MODES', () => {
  it('lists five modes with label and desc', () => {
    expect(OUTPUT_MODES).toHaveLength(5);
    const values = OUTPUT_MODES.map((m) => m.value);
    expect(values).toEqual(['auto', 'natural', 'fast', 'offline', 'minimal']);
  });

  it.each(OUTPUT_MODES)('$value has a non-empty label and desc', (mode) => {
    expect(mode.label).toBeTruthy();
    expect(mode.desc).toBeTruthy();
    expect(typeof mode.label).toBe('string');
    expect(typeof mode.desc).toBe('string');
  });
});

describe('getOutputModeChain', () => {
  it('maps auto to all five engines in default priority order', () => {
    expect(getOutputModeChain('auto')).toEqual([
      'localFile',
      'native',
      'supertonic',
      'browserTts',
      'espeak',
    ]);
  });

  it('maps offline to localFile, espeak, supertonic', () => {
    expect(getOutputModeChain('offline')).toEqual(['localFile', 'espeak', 'supertonic']);
  });

  it('returns a mutable copy of the underlying chain', () => {
    const chain = getOutputModeChain('minimal');
    chain.push('localFile');
    expect(getOutputModeChain('minimal')).toEqual(['browserTts', 'espeak']);
  });
});

describe('getEngineStatus', () => {
  describe('disabled', () => {
    it('returns disabled when the engine is not in fallbackEngines', () => {
      const pronunciation = makePronunciationSettings({ fallbackEngines: ['native', 'browserTts'] });
      const tts = makeTtsSettings();
      expect(getEngineStatus('localFile', pronunciation, tts)).toBe('disabled');
      expect(getEngineStatus('supertonic', pronunciation, tts)).toBe('disabled');
      expect(getEngineStatus('espeak', pronunciation, tts)).toBe('disabled');
    });
  });

  describe('localFile', () => {
    it('is ready when a DSL file is selected and indexed', () => {
      const pronunciation = makePronunciationSettings({
        localFile: {
          packageType: 'single',
          dslFileHandleId: 'dsl-123',
          audioArchiveHandleId: null,
          splitArchiveDirectoryHandleId: null,
          splitArchivePattern: '',
          lastIndexedAt: 1_700_000_000_000,
        },
      });
      expect(getEngineStatus('localFile', pronunciation, makeTtsSettings())).toBe('ready');
    });

    it('is missing when the DSL file handle is missing', () => {
      const pronunciation = makePronunciationSettings({
        localFile: {
          packageType: 'single',
          dslFileHandleId: null,
          audioArchiveHandleId: null,
          splitArchiveDirectoryHandleId: null,
          splitArchivePattern: '',
          lastIndexedAt: null,
        },
      });
      expect(getEngineStatus('localFile', pronunciation, makeTtsSettings())).toBe('missing');
    });

    it('is missing when the index has not been built', () => {
      const pronunciation = makePronunciationSettings({
        localFile: {
          packageType: 'single',
          dslFileHandleId: 'dsl-123',
          audioArchiveHandleId: null,
          splitArchiveDirectoryHandleId: null,
          splitArchivePattern: '',
          lastIndexedAt: null,
        },
      });
      expect(getEngineStatus('localFile', pronunciation, makeTtsSettings())).toBe('missing');
    });
  });

  describe('supertonic', () => {
    it('is ready when English is in downloadedLanguages', () => {
      const tts = makeTtsSettings({ downloadedLanguages: ['en'] });
      expect(getEngineStatus('supertonic', makePronunciationSettings(), tts)).toBe('ready');
    });

    it('is missing when English is not downloaded', () => {
      const tts = makeTtsSettings({ downloadedLanguages: ['vi', 'fr'] });
      expect(getEngineStatus('supertonic', makePronunciationSettings(), tts)).toBe('missing');
    });
  });

  describe('espeak', () => {
    it('is ready when downloadEspeakTtsData is true', () => {
      const pronunciation = makePronunciationSettings({ downloadEspeakTtsData: true });
      expect(getEngineStatus('espeak', pronunciation, makeTtsSettings())).toBe('ready');
    });

    it('is missing when downloadEspeakTtsData is false', () => {
      const pronunciation = makePronunciationSettings({ downloadEspeakTtsData: false });
      expect(getEngineStatus('espeak', pronunciation, makeTtsSettings())).toBe('missing');
    });
  });

  describe('native', () => {
    it('is ready when in fallbackEngines', () => {
      const pronunciation = makePronunciationSettings({ fallbackEngines: ['native'] });
      expect(getEngineStatus('native', pronunciation, makeTtsSettings())).toBe('ready');
    });

    it('is disabled when not in fallbackEngines', () => {
      const pronunciation = makePronunciationSettings({ fallbackEngines: ['localFile'] });
      expect(getEngineStatus('native', pronunciation, makeTtsSettings())).toBe('disabled');
    });
  });

  describe('browserTts', () => {
    it('is ready when in fallbackEngines', () => {
      const pronunciation = makePronunciationSettings({ fallbackEngines: ['browserTts'] });
      expect(getEngineStatus('browserTts', pronunciation, makeTtsSettings())).toBe('ready');
    });

    it('is disabled when not in fallbackEngines', () => {
      const pronunciation = makePronunciationSettings({ fallbackEngines: ['localFile'] });
      expect(getEngineStatus('browserTts', pronunciation, makeTtsSettings())).toBe('disabled');
    });
  });
});
