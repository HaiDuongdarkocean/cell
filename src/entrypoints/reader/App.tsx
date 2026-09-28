import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { parseTxtBook } from '@/features/reader/logic/bookParser';
import {
  getAllBooks,
  getBook,
  saveBook,
  deleteBook,
  getProgress,
  saveProgress,
  type BookRecord,
} from '@/features/reader/services/readerRepository';
import { TokenizedParagraph } from '@/features/reader/ui/TokenizedParagraph';
import { TtsControlBar } from '@/features/reader/ui/TtsControlBar';
import { getSentenceText } from '@/features/reader/logic/sentenceText';
import { formatDuration } from '@/features/reader/logic/formatTime';
import { tokenizeTextBlock } from '@/features/tokenize/logic/textTokenizer';
import { DictionaryPanelView } from '@/features/dictionaryPopup/ui/DictionaryPanelView';
import { ComprehensionBadge } from '@/features/tokenize/ui/ComprehensionBadge';
import { createBookScoreTracker } from '@/features/reader/logic/bookScore';
import { emitWordStatusChanged, onWordStatusChanged, type WordStatusChangedDetail } from '@/features/dictionary';
import { languageMatches } from '@/shared/config/languageRegistry';
import type { ScoreTracker } from '@/features/tokenize/logic/comprehensionScore';
import type { ComprehensionStats } from '@/entities/comprehension';
import type { Token } from '@/features/tokenize/types';
import { t } from '@/shared/i18n';
import styles from './App.module.css';

type View = 'library' | 'reader';

export function ReaderApp(): React.JSX.Element {
  const [view, setView] = useState<View>('library');
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookRecord | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
  const [selectedParagraph, setSelectedParagraph] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<string>('vi');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cumulativeReadTimeRef = useRef<number>(0);
  const readStartAtRef = useRef<number>(Date.now());
  const isReadPausedRef = useRef<boolean>(false);
  const [, setTick] = useState<number>(0);
  const [bookStats, setBookStats] = useState<ComprehensionStats | null>(null);
  const bookTrackerRef = useRef<ScoreTracker | null>(null);

  const loadBooks = useCallback(async () => {
    try {
      setBooks(await getAllBooks());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reader.error.loadLibrary'));
    }
  }, []);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    if (!selectedBook) {
      bookTrackerRef.current = null;
      setBookStats(null);
      return;
    }
    const book = selectedBook;
    const lang = book.languageCode ?? 'en';
    let cancelled = false;
    let resolving = true;
    const buffered: WordStatusChangedDetail[] = [];
    bookTrackerRef.current = null;
    setBookStats(null);
    void createBookScoreTracker(book.paragraphs, lang, () => cancelled).then((tracker) => {
      resolving = false;
      if (cancelled) return;
      if (tracker) {
        for (const e of buffered) tracker.applyStatus(e.term, e.status);
      }
      buffered.length = 0;
      bookTrackerRef.current = tracker;
      setBookStats(tracker?.stats('text') ?? null);
    }).catch((err) => {
      resolving = false;
      console.warn('[reader] book score resolve failed', err);
    });
    const offStatus = onWordStatusChanged((e) => {
      if (!languageMatches(lang, e.langCode)) return;
      if (resolving) {
        buffered.push(e);
        return;
      }
      if (bookTrackerRef.current?.applyStatus(e.term, e.status)) {
        setBookStats(bookTrackerRef.current.stats('text'));
      }
    });
    return () => {
      cancelled = true;
      offStatus();
    };
  }, [selectedBook]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = await parseTxtBook(file);
        const now = new Date().toISOString();
        const book: BookRecord = {
          ...parsed,
          id: crypto.randomUUID(),
          addedAt: now,
          lastReadAt: now,
        };
        await saveBook(book);
        await loadBooks();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('reader.error.import'));
      } finally {
        input.value = '';
      }
    },
    [loadBooks],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteBook(id);
        if (selectedBook?.id === id) {
          setSelectedBook(null);
          setSelectedToken(null);
          setSelectedTokenIndex(null);
          setSelectedParagraph(null);
          setView('library');
        }
        await loadBooks();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('reader.error.delete'));
      }
    },
    [loadBooks, selectedBook],
  );

  const handleOpen = useCallback(async (book: BookRecord) => {
    try {
      const progress = await getProgress(book.id);
      setSelectedBook(book);
      setSelectedToken(null);
      setSelectedTokenIndex(null);
      setView('reader');
      if (progress) {
        setSelectedParagraph(progress.paragraphIndex);
        const paragraph = book.paragraphs[progress.paragraphIndex] ?? '';
        const tokens = tokenizeTextBlock(paragraph, book.languageCode ?? 'en');
        const token = tokens[progress.tokenIndex];
        if (token) {
          setSelectedTokenIndex(progress.tokenIndex);
          setSelectedToken(token);
        }
        cumulativeReadTimeRef.current = progress.readTimeMs ?? 0;
      } else {
        setSelectedParagraph(null);
        cumulativeReadTimeRef.current = 0;
      }
      readStartAtRef.current = Date.now();
      isReadPausedRef.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reader.error.open'));
    }
  }, []);

  const handleBack = useCallback(() => {
    setView('library');
    setSelectedBook(null);
    setSelectedToken(null);
    setSelectedTokenIndex(null);
    setSelectedParagraph(null);
  }, []);

  const handleTokenClick = useCallback(
    (paragraphIndex: number) => (token: Token, tokenIndex: number) => {
      setSelectedParagraph(paragraphIndex);
      setSelectedTokenIndex(tokenIndex);
      setSelectedToken(token);
    },
    [],
  );

  // Load book from URL query + resume progress
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('bookId');
    if (!bookId) return;
    const init = async () => {
      try {
        const book = await getBook(bookId);
        if (!book) return;
        const progress = await getProgress(bookId);
        setSelectedBook(book);
        setView('reader');
        if (progress) {
          setSelectedParagraph(progress.paragraphIndex);
          cumulativeReadTimeRef.current = progress.readTimeMs ?? 0;
          readStartAtRef.current = Date.now();
          isReadPausedRef.current = false;
          const paragraph = book.paragraphs[progress.paragraphIndex] ?? '';
          const tokens = tokenizeTextBlock(paragraph, book.languageCode ?? 'en');
          const token = tokens[progress.tokenIndex];
          if (token) {
            setSelectedTokenIndex(progress.tokenIndex);
            setSelectedToken(token);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('reader.error.open'));
      }
    };
    void init();
  }, []);

  // Auto-save progress on selection change
  useEffect(() => {
    if (!selectedBook || selectedParagraph === null || selectedTokenIndex === null) return;
    const elapsed = isReadPausedRef.current ? 0 : Date.now() - readStartAtRef.current;
    void saveProgress({
      bookId: selectedBook.id,
      paragraphIndex: selectedParagraph,
      tokenIndex: selectedTokenIndex,
      updatedAt: new Date().toISOString(),
      readTimeMs: cumulativeReadTimeRef.current + elapsed,
    });
  }, [selectedBook, selectedParagraph, selectedTokenIndex]);

  // Scroll to resumed paragraph when a book is opened
  useEffect(() => {
    if (!selectedBook || selectedParagraph === null) return;
    const element = document.querySelector(`[data-paragraph-index="${selectedParagraph}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [selectedBook, selectedParagraph]);

  // Load the user's native/target language for dictionary translation
  useEffect(() => {
    loadSettings()
      .then((settings) => {
        const activeProfile = settings.languageProfiles.find(
          (profile) => profile.id === settings.activeProfileId,
        );
        const native = activeProfile?.native || settings.universalNativeLanguage;
        if (native) setTargetLang(native);
      })
      .catch(() => {
        // keep default 'vi'
      });
  }, []);

  // Save progress on tab hide / before close
  useEffect(() => {
    if (!selectedBook || selectedParagraph === null || selectedTokenIndex === null) return;
    const progress = {
      bookId: selectedBook.id,
      paragraphIndex: selectedParagraph,
      tokenIndex: selectedTokenIndex,
      updatedAt: new Date().toISOString(),
      readTimeMs: 0,
    };
    const handleVisibility = () => {
      if (document.hidden) {
        cumulativeReadTimeRef.current += Date.now() - readStartAtRef.current;
        isReadPausedRef.current = true;
        void saveProgress({ ...progress, readTimeMs: cumulativeReadTimeRef.current });
      } else {
        isReadPausedRef.current = false;
        readStartAtRef.current = Date.now();
      }
    };
    const handleBeforeUnload = () => {
      if (!isReadPausedRef.current) {
        cumulativeReadTimeRef.current += Date.now() - readStartAtRef.current;
        isReadPausedRef.current = true;
      }
      void saveProgress({ ...progress, readTimeMs: cumulativeReadTimeRef.current });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      if (!isReadPausedRef.current) {
        cumulativeReadTimeRef.current += Date.now() - readStartAtRef.current;
        isReadPausedRef.current = true;
      }
      void saveProgress({ ...progress, readTimeMs: cumulativeReadTimeRef.current });
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [selectedBook, selectedParagraph, selectedTokenIndex]);

  // Update live read-time display every second while a book is open
  useEffect(() => {
    if (!selectedBook) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [selectedBook]);

  // Refs hold the actual cumulative time; the 1s interval tick above is the
  // render trigger so this recomputes once per second.
  const elapsed = isReadPausedRef.current
    ? 0
    : Date.now() - readStartAtRef.current;
  const readTimeSeconds = Math.floor((cumulativeReadTimeRef.current + elapsed) / 1000);

  const progressPercent = useMemo(() => {
    if (!selectedBook || selectedParagraph === null) return 0;
    return Math.min(
      100,
      Math.round(((selectedParagraph + 1) / selectedBook.paragraphs.length) * 100),
    );
  }, [selectedBook, selectedParagraph]);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {view === 'reader' && selectedBook ? selectedBook.title : t('reader.title')}
        </h1>
        {view === 'reader' && selectedBook && (
          <span className={styles.readerStats}>
            {bookStats && <ComprehensionBadge stats={bookStats} />}
            {progressPercent}% · {formatDuration(readTimeSeconds)}
          </span>
        )}
        {view === 'reader' && (
          <Button variant="outline" size="sm" onClick={handleBack}>
            {t('ui.back')}
          </Button>
        )}
        {view === 'library' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              hidden
              onChange={(e) => { void handleFileChange(e); }}
            />
            <Button onClick={() => fileInputRef.current?.click()}>{t('reader.action.import')}</Button>
          </>
        )}
      </header>

      {error && <p className={styles.empty}>{error}</p>}

      {view === 'library' && (
        <section className={styles.library}>
          {books.length === 0 ? (
            <p className={styles.empty}>{t('reader.library.empty')}</p>
          ) : (
            <ul className={styles.bookList}>
              {books.map((book) => (
                <li
                  key={book.id}
                  className={styles.bookItem}
                  onClick={() => { void handleOpen(book); }}
                >
                  <span className={styles.bookTitle}>{book.title}</span>
                  <span className={styles.bookMeta}>
                    {t('reader.library.paragraphs', [book.paragraphs.length])}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDelete(book.id);
                    }}
                  >
                    {t('reader.action.delete')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {view === 'reader' && selectedBook && (
        <>
          <section className={styles.reader}>
            <div className={styles.paragraphs}>
              {selectedBook.paragraphs.map((paragraph, index) => (
                <TokenizedParagraph
                  key={index}
                  paragraphIndex={index}
                  text={paragraph}
                  langCode={selectedBook.languageCode ?? 'en'}
                  onTokenClick={handleTokenClick(index)}
                />
              ))}
            </div>
          </section>

          {selectedToken && selectedParagraph !== null && (
            <footer className={styles.selectedBar}>
              <TtsControlBar
                paragraph={selectedBook.paragraphs[selectedParagraph] ?? ''}
                sentenceIndex={selectedToken.sentenceIndex}
                langCode={selectedBook.languageCode ?? 'en'}
              />
              <div className={styles.dictionaryPanel}>
                <DictionaryPanelView
                  key={`${selectedToken.term}-${selectedToken.start}`}
                  variant="popup"
                  langCode={selectedBook.languageCode ?? 'en'}
                  sourceLang={selectedBook.languageCode ?? 'en'}
                  targetLang={targetLang}
                  initialTerm={selectedToken.term}
                  contextSentence={getSentenceText(
                    tokenizeTextBlock(
                      selectedBook.paragraphs[selectedParagraph] ?? '',
                      selectedBook.languageCode ?? 'en',
                    ),
                    selectedBook.paragraphs[selectedParagraph] ?? '',
                    selectedToken.sentenceIndex,
                  )}
                  cursorOffset={selectedToken.start}
                  onStatusChange={(term, langCode, status) =>
                    emitWordStatusChanged({ term, langCode, status })
                  }
                />
              </div>
            </footer>
          )}
        </>
      )}
    </div>
  );
}

