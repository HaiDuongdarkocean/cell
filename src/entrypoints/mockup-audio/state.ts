import { useCallback, useState } from 'react';
import type { PronunciationSettings, TtsSettings, TtsVoiceRow } from '@/entities/settings/types';
import {
  DEFAULT_MOCK_AUDIO_SETTINGS,
  DEFAULT_TESTER_VOICES,
  moveEngine as moveEngineInList,
  updateLocalFile as patchLocalFile,
  padSlots,
  type TesterVoiceRow,
} from './mockData';

export interface AudioMockState {
  pronunciation: PronunciationSettings;
  tts: TtsSettings;
  testWord: string;
  testMode: 'chain' | 'tts';
  playing: boolean;
  status: string | null;
  testerText: string;
  testerFilter: string;
  testerVoices: TesterVoiceRow[];
}

const INITIAL: AudioMockState = {
  ...DEFAULT_MOCK_AUDIO_SETTINGS,
  testWord: 'hello',
  testMode: 'chain',
  playing: false,
  status: null,
  testerText: 'Hello, this is a text-to-speech test.',
  testerFilter: '',
  testerVoices: DEFAULT_TESTER_VOICES,
};

export interface UseMockAudioReturn {
  state: AudioMockState;
  setPronunciation: (next: PronunciationSettings) => void;
  setTts: (next: TtsSettings) => void;
  moveEngine: (index: number, direction: -1 | 1) => void;
  setDownloadEspeak: (value: boolean) => void;
  updateLocalFile: (partial: Partial<PronunciationSettings['localFile']>) => void;
  pickDsl: () => void;
  pickArchive: () => void;
  pickSplitDirectory: () => void;
  buildIndex: () => void;
  setTtsEnabled: (value: boolean) => void;
  setMaxDisplay: (value: number) => void;
  setAutoplayCount: (value: number) => void;
  setVoiceSlot: (slotIndex: number, voiceName: string | null) => void;
  setTesterText: (value: string) => void;
  setTesterFilter: (value: string) => void;
  toggleTesterVoice: (voiceName: string) => void;
  setTesterVoiceOrder: (voiceName: string, order: number) => void;
  clearTesterSelection: () => void;
  saveTesterSelection: () => void;
  playVoice: (voiceName: string) => void;
  setLocalTtsEnabled: (value: boolean) => void;
  setLocalTtsLanguage: (value: string) => void;
  downloadLanguage: (lang: string) => void;
  deleteLanguage: (lang: string) => void;
  toggleHiddenLanguage: (lang: string) => void;
  setTestWord: (value: string) => void;
  setTestMode: (value: 'chain' | 'tts') => void;
  playTest: () => void;
}

export function useMockAudio(): UseMockAudioReturn {
  const [state, setState] = useState<AudioMockState>(INITIAL);

  const patchPronunciation = useCallback(
    (partial: Partial<PronunciationSettings>) => {
      setState((prev) => ({ ...prev, pronunciation: { ...prev.pronunciation, ...partial } }));
    },
    [],
  );

  const patchTts = useCallback(
    (partial: Partial<TtsSettings>) => {
      setState((prev) => ({ ...prev, tts: { ...prev.tts, ...partial } }));
    },
    [],
  );

  const setPronunciation = useCallback(
    (next: PronunciationSettings) => setState((prev) => ({ ...prev, pronunciation: next })),
    [],
  );

  const setTts = useCallback(
    (next: TtsSettings) => setState((prev) => ({ ...prev, tts: next })),
    [],
  );

  const moveEngine = useCallback(
    (index: number, direction: -1 | 1) => {
      setState((prev) => ({
        ...prev,
        pronunciation: {
          ...prev.pronunciation,
          fallbackEngines: moveEngineInList(prev.pronunciation.fallbackEngines, index, direction),
        },
        status: null,
      }));
    },
    [],
  );

  const setDownloadEspeak = useCallback(
    (value: boolean) => patchPronunciation({ downloadEspeakTtsData: value }),
    [patchPronunciation],
  );

  const updateLocalFile = useCallback(
    (partial: Partial<PronunciationSettings['localFile']>) => {
      setState((prev) => ({
        ...prev,
        pronunciation: {
          ...prev.pronunciation,
          localFile: patchLocalFile(prev.pronunciation.localFile, partial),
        },
        status: null,
      }));
    },
    [],
  );

  const pickDsl = useCallback(() => {
    const id = `dsl-${Date.now()}`;
    updateLocalFile({ dslFileHandleId: id });
    setState((prev) => ({ ...prev, status: 'Selected index file: ForvoEnglish.dsl' }));
  }, [updateLocalFile]);

  const pickArchive = useCallback(() => {
    const id = `zip-${Date.now()}`;
    updateLocalFile({ audioArchiveHandleId: id, packageType: 'single' });
    setState((prev) => ({ ...prev, status: 'Selected audio archive: ForvoEnglish.dsl.files.zip' }));
  }, [updateLocalFile]);

  const pickSplitDirectory = useCallback(() => {
    const id = `split-${Date.now()}`;
    updateLocalFile({ splitArchiveDirectoryHandleId: id, packageType: 'split' });
    setState((prev) => ({ ...prev, status: 'Selected audio folder: ForvoEnglish' }));
  }, [updateLocalFile]);

  const buildIndex = useCallback(() => {
    setState((prev) => {
      if (!prev.pronunciation.localFile.dslFileHandleId) {
        return { ...prev, status: 'Choose an index file first.' };
      }
      return {
        ...prev,
        pronunciation: {
          ...prev.pronunciation,
          localFile: patchLocalFile(prev.pronunciation.localFile, { lastIndexedAt: Date.now() }),
        },
        status: 'Indexed 124,800 entries.',
      };
    });
  }, []);

  const setTtsEnabled = useCallback(
    (value: boolean) => patchTts({ enabled: value }),
    [patchTts],
  );

  const setMaxDisplay = useCallback(
    (value: number) => patchTts({ maxDisplay: value }),
    [patchTts],
  );

  const setAutoplayCount = useCallback(
    (value: number) => patchTts({ autoplayCount: value }),
    [patchTts],
  );

  const setVoiceSlot = useCallback(
    (slotIndex: number, voiceName: string | null) => {
      setState((prev) => {
        const slots = padSlots(prev.tts.voices);
        if (slots[slotIndex] === voiceName) {
          slots[slotIndex] = null;
        } else {
          for (let i = 0; i < slots.length; i++) {
            if (slots[i] === voiceName) slots[i] = null;
          }
          slots[slotIndex] = voiceName;
        }
        const voices: string[] = slots.filter((v): v is string => Boolean(v));
        return {
          ...prev,
          tts: { ...prev.tts, voices },
          status: null,
        };
      });
    },
    [],
  );

  const setTesterText = useCallback(
    (value: string) => setState((prev) => ({ ...prev, testerText: value })),
    [],
  );

  const setTesterFilter = useCallback(
    (value: string) => setState((prev) => ({ ...prev, testerFilter: value })),
    [],
  );

  const toggleTesterVoice = useCallback((voiceName: string) => {
    setState((prev) => ({
      ...prev,
      testerVoices: prev.testerVoices.map((r) =>
        r.voiceName === voiceName ? { ...r, selected: !r.selected } : r,
      ),
    }));
  }, []);

  const setTesterVoiceOrder = useCallback((voiceName: string, order: number) => {
    if (!Number.isFinite(order) || order < 1) return;
    setState((prev) => ({
      ...prev,
      testerVoices: prev.testerVoices.map((r) =>
        r.voiceName === voiceName ? { ...r, order } : r,
      ),
    }));
  }, []);

  const clearTesterSelection = useCallback(
    () => setState((prev) => ({ ...prev, testerVoices: prev.testerVoices.map((r) => ({ ...r, selected: false })) })),
    [],
  );

  const saveTesterSelection = useCallback(() => {
    setState((prev) => {
      const saved: TtsVoiceRow[] = prev.testerVoices
        .filter((r) => r.selected)
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((r, i) => ({ voiceName: r.voiceName, lang: r.lang, order: i + 1 }));
      return { ...prev, tts: { ...prev.tts, savedVoices: saved }, status: `Saved ${saved.length} voices.` };
    });
  }, []);

  const playVoice = useCallback((voiceName: string) => {
    setState((prev) => ({ ...prev, playing: true, status: `Playing ${voiceName}…` }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, playing: false, status: 'Played.' }));
    }, 1200);
  }, []);

  const setLocalTtsEnabled = useCallback(
    (value: boolean) => patchTts({ localTtsEnabled: value }),
    [patchTts],
  );

  const setLocalTtsLanguage = useCallback(
    (value: string) => patchTts({ localTtsLanguage: value }),
    [patchTts],
  );

  const downloadLanguage = useCallback((lang: string) => {
    setState((prev) => ({
      ...prev,
      tts: {
        ...prev.tts,
        downloadedLanguages: Array.from(new Set([...prev.tts.downloadedLanguages, lang])),
        localTtsLanguage: lang,
      },
      status: `Downloading ${lang} voice pack…`,
    }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, status: `Downloaded ${lang} voice pack.` }));
    }, 800);
  }, []);

  const deleteLanguage = useCallback((lang: string) => {
    setState((prev) => ({
      ...prev,
      tts: {
        ...prev.tts,
        downloadedLanguages: prev.tts.downloadedLanguages.filter((l) => l !== lang),
        hiddenLanguages: prev.tts.hiddenLanguages.filter((l) => l !== lang),
        localTtsLanguage:
          prev.tts.localTtsLanguage === lang
            ? (prev.tts.downloadedLanguages.find((l) => l !== lang) ?? '')
            : prev.tts.localTtsLanguage,
      },
      status: `Deleted ${lang} voice pack.`,
    }));
  }, []);

  const toggleHiddenLanguage = useCallback((lang: string) => {
    setState((prev) => {
      const next = new Set(prev.tts.hiddenLanguages);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return { ...prev, tts: { ...prev.tts, hiddenLanguages: Array.from(next) } };
    });
  }, []);

  const setTestWord = useCallback(
    (value: string) => setState((prev) => ({ ...prev, testWord: value })),
    [],
  );

  const setTestMode = useCallback(
    (value: 'chain' | 'tts') => setState((prev) => ({ ...prev, testMode: value })),
    [],
  );

  const playTest = useCallback(() => {
    setState((prev) => {
      const text = prev.testWord.trim();
      if (!text) {
        return { ...prev, status: 'Type a word first.' };
      }
      return {
        ...prev,
        playing: true,
        status: prev.testMode === 'chain' ? 'Playing through the priority chain…' : 'Playing selected TTS voice…',
      };
    });
    setTimeout(() => {
      setState((prev) => ({ ...prev, playing: false, status: 'Played.' }));
    }, 1200);
  }, []);

  return {
    state,
    setPronunciation,
    setTts,
    moveEngine,
    setDownloadEspeak,
    updateLocalFile,
    pickDsl,
    pickArchive,
    pickSplitDirectory,
    buildIndex,
    setTtsEnabled,
    setMaxDisplay,
    setAutoplayCount,
    setVoiceSlot,
    setTesterText,
    setTesterFilter,
    toggleTesterVoice,
    setTesterVoiceOrder,
    clearTesterSelection,
    saveTesterSelection,
    playVoice,
    setLocalTtsEnabled,
    setLocalTtsLanguage,
    downloadLanguage,
    deleteLanguage,
    toggleHiddenLanguage,
    setTestWord,
    setTestMode,
    playTest,
  };
}
