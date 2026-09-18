import { useEffect, useRef } from 'react';
import type { FileCache } from '../logic/fileCache';
import {
  defaultLibraryScoreDeps,
  runLibraryScoring,
  type LibraryScoreDeps,
  type TokenCache,
} from '../logic/libraryScoreService';
import {
  getAllVideos,
  type SubtitleRecord,
  type VideoRecord,
} from '@/features/local-player/services/mediaLibraryRepository';
import {
  onWordStatusChanged,
  onWordStatusRemoved,
} from '@/features/dictionary/services/wordStatusEvents';
import { languageMatches } from '@/shared/config/languageRegistry';
import type { RefObject } from 'react';

const SCORE_LANG = 'en';
const SCORE_NATIVE_LANG = 'vi';
const STATUS_DEBOUNCE_MS = 400;
const STATUS_MAX_DELAY_MS = 1500;

export interface UseLibraryScoresArgs {
  videos: readonly VideoRecord[];
  subtitles: readonly SubtitleRecord[];
  fileMapRef: RefObject<FileCache>;
  setLibrary: (videos: VideoRecord[]) => void;
  deps?: Partial<LibraryScoreDeps>;
}

export function useLibraryScores(args: UseLibraryScoresArgs): void {
  const { videos, subtitles, fileMapRef, setLibrary } = args;
  const depsRef = useRef<LibraryScoreDeps>({
    ...defaultLibraryScoreDeps,
    ...args.deps,
  });
  const tokenCacheRef = useRef<TokenCache>(new Map());
  const generationRef = useRef(0);
  const inputsRef = useRef({ videos, subtitles });
  inputsRef.current = { videos, subtitles };
  const setLibraryRef = useRef(setLibrary);
  setLibraryRef.current = setLibrary;
  const trailingRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const maxDelayRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const runRef = useRef<() => Promise<void>>(async () => {});
  runRef.current = async (): Promise<void> => {
    const generation = ++generationRef.current;
    const { videos: v, subtitles: s } = inputsRef.current;
    const res = await runLibraryScoring({
      videos: v,
      subtitles: s,
      fileMap: fileMapRef.current,
      deps: depsRef.current,
      tokenCache: tokenCacheRef.current,
      isCurrent: () => generationRef.current === generation,
      targetLang: SCORE_LANG,
      nativeLang: SCORE_NATIVE_LANG,
    });
    if (res.writes === 0 || generationRef.current !== generation) return;
    const fresh = await getAllVideos().catch(() => undefined);
    if (!fresh || generationRef.current !== generation) return;
    setLibraryRef.current(fresh);
  };

  useEffect(() => {
    void runRef.current();
  }, [videos, subtitles]);

  useEffect(() => {
    const schedule = (): void => {
      if (trailingRef.current) clearTimeout(trailingRef.current);
      if (!maxDelayRef.current) {
        maxDelayRef.current = setTimeout(() => {
          maxDelayRef.current = undefined;
          if (trailingRef.current) clearTimeout(trailingRef.current);
          trailingRef.current = undefined;
          void runRef.current();
        }, STATUS_MAX_DELAY_MS);
      }
      trailingRef.current = setTimeout(() => {
        trailingRef.current = undefined;
        if (maxDelayRef.current) clearTimeout(maxDelayRef.current);
        maxDelayRef.current = undefined;
        void runRef.current();
      }, STATUS_DEBOUNCE_MS);
    };
    const offChanged = onWordStatusChanged((e) => {
      if (languageMatches(SCORE_LANG, e.langCode)) schedule();
    });
    const offRemoved = onWordStatusRemoved((e) => {
      if (languageMatches(SCORE_LANG, e.langCode)) schedule();
    });
    return () => {
      offChanged();
      offRemoved();
      if (trailingRef.current) clearTimeout(trailingRef.current);
      if (maxDelayRef.current) clearTimeout(maxDelayRef.current);
      trailingRef.current = undefined;
      maxDelayRef.current = undefined;
    };
  }, []);

  useEffect(
    () => () => {
      generationRef.current++;
    },
    [],
  );
}
