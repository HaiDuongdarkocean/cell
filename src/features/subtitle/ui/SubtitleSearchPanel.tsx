/**
 * SubtitleSearchPanel — search UI for SubDL / OpenSubtitles.
 *
 * Renders inside SubtitleManagerPanel above the Target/Native sections.
 * Debounced input (300ms) + AbortController cancel in-flight requests.
 * Background owns all network calls (SEARCH_SUBTITLES message).
 *
 * Spec: docs/specs/subtitle-search.md — UI Design section.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { Input } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { LANGUAGES } from '@/shared/config/languageRegistry';
import { ApiKeyManager } from '@/features/settings/ui/ApiKeyManager';
import { parseSubtitle } from '../logic/subtitleParser';
import type { SrtCue } from '@/entities/media';
import type { SubtitleSearchResult, SearchQuery, SearchError } from '../logic/subtitleSearchTypes';
import type { ResolveSubtitleDownloadResult } from '@/entities/message';
import type { SubtitleApiKey } from '@/entities/settings';
import styles from './SubtitleSearchPanel.module.css';

export interface SubtitleSearchPanelProps {
  readonly hasSearchKeys: boolean;
  readonly apiKeys: readonly SubtitleApiKey[];
  readonly onApiKeysChange: (keys: SubtitleApiKey[]) => void;
  readonly onSearchResultSelect: (result: SubtitleSearchResult, role: 'target' | 'native', cues?: SrtCue[]) => void;
}

const DEBOUNCE_MS = 300;
const ALL_LANGUAGES_VALUE = 'all';
const SKELETON_COUNT = 4;
const PREVIEW_CUE_COUNT = 8;

interface SearchResponse {
  readonly results?: SubtitleSearchResult[];
  readonly error?: SearchError;
}

interface SearchResultRowProps {
  readonly result: SubtitleSearchResult;
  readonly index: number;
  readonly isSelected: boolean;
  readonly previewCues: readonly SrtCue[] | null;
  readonly previewLoading: boolean;
  readonly previewError: string | null;
  readonly onSelect: () => void;
  readonly onRolePick: (role: 'target' | 'native') => void;
}

function formatPreviewTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function languageLabel(iso: string): string {
  const entry = LANGUAGES.find((l) => l.iso1 === iso);
  if (!entry) return iso;
  return entry.native === entry.english ? entry.english : `${entry.native} (${entry.english})`;
}

function describeError(err: SearchError): string {
  switch (err.type) {
    case 'no-key':
      return `No API key for ${err.provider}. Add one below.`;
    case 'quota-exhausted':
      return `All ${err.provider} keys exhausted. Add more in Settings.`;
    case 'rate-limited':
      return `${err.provider} rate-limited. Try again in ${Math.ceil(err.retryAfterMs / 1000)}s.`;
    case 'auth-invalid':
      return `${err.provider} key invalid. Check Settings.`;
    case 'network':
      return `Network error: ${err.message}`;
    case 'parse':
      return `Parse error: ${err.message}`;
  }
}

function SearchResultRow({ result, index, isSelected, previewCues, previewLoading, previewError, onSelect, onRolePick }: SearchResultRowProps): React.JSX.Element {
  return (
    <li className={styles.resultItem} role="option" aria-selected={isSelected} data-cell-id={`search-result-${index}`}>
      <button
        type="button"
        className={styles.resultButton}
        onClick={onSelect}
        data-cell-id={`search-result-button-${index}`}
      >
        <span className={styles.resultName}>{result.name}</span>
        <span className={styles.resultMeta}>
          <span className={styles.resultLang}>{languageLabel(result.isoLanguage)}</span>
          <span className={styles.resultSource}>{result.source}</span>
          {result.format && <span className={styles.resultFormat}>{result.format.toUpperCase()}</span>}
          {result.sdh && <span className={styles.resultBadge}>SDH</span>}
          {result.forced && <span className={styles.resultBadge}>Forced</span>}
        </span>
      </button>
      {isSelected && (
        <div className={styles.previewPanel} data-cell-id={`search-preview-${index}`}>
          <div className={styles.previewHead}>
            <div className={styles.previewHeadInfo}>
              <span className={styles.previewHeadName}>{result.name}</span>
              {previewCues && <span className={styles.previewHeadMeta}>{previewCues.length} cues</span>}
            </div>
          </div>
          <div className={styles.previewList}>
            {previewLoading && (
              <div className={styles.previewLoading}>
                <Skeleton width="90%" height={14} />
                <Skeleton width="70%" height={14} />
                <Skeleton width="80%" height={14} />
              </div>
            )}
            {!previewLoading && previewError && (
              <div className={styles.previewError}>{previewError}</div>
            )}
            {!previewLoading && !previewError && previewCues && (
              <>
                {previewCues.slice(0, PREVIEW_CUE_COUNT).map((cue) => (
                  <div key={cue.index} className={styles.previewCue}>
                    <span className={styles.previewCueTime}>{formatPreviewTime(cue.start)}</span>
                    <div className={styles.previewCueText}>{cue.text}</div>
                  </div>
                ))}
                {previewCues.length > PREVIEW_CUE_COUNT && (
                  <div className={styles.previewMore}>
                    +{previewCues.length - PREVIEW_CUE_COUNT} more cues
                  </div>
                )}
              </>
            )}
          </div>
          <div className={styles.previewFooter} data-cell-id={`search-role-picker-${index}`}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onRolePick('target')}
              disabled={previewLoading || !!previewError}
              data-cell-id={`search-load-target-${index}`}
            >
              Load as Target
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRolePick('native')}
              disabled={previewLoading || !!previewError}
              data-cell-id={`search-load-native-${index}`}
            >
              Load as Native
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function SubtitleSearchPanel({ hasSearchKeys, apiKeys, onApiKeysChange, onSearchResultSelect }: SubtitleSearchPanelProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<string>(ALL_LANGUAGES_VALUE);
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [results, setResults] = useState<readonly SubtitleSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<number | null>(null);
  const [previewCues, setPreviewCues] = useState<readonly SrtCue[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewCacheRef = useRef<Map<string, SrtCue[]>>(new Map());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef('');

  // Load default languages from settings on mount.
  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const settings = await loadSettings();
        const target = settings.subtitleOverlayTargetLanguage ?? '';
        const native = settings.subtitleOverlayNativeLanguage ?? '';
        const langs = [target, native].filter(Boolean);
        // If both target+native exist and differ, default to "all" (search broadly).
        // Otherwise default to the single configured language.
        if (langs.length > 0 && langs.length < 2) {
          setLanguage(langs[0]!);
        }
      } catch {
        // Settings load failure — keep "all" default.
      }
    })();
  }, []);

  const doSearch = useCallback(async (q: string, lang: string, s: string, e: string): Promise<void> => {
    if (!q.trim()) {
      setResults([]);
      setError(null);
      setHasSearched(false);
      return;
    }

    // Abort previous in-flight request.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    const languages = lang === ALL_LANGUAGES_VALUE ? [] : [lang];
    const seasonNum = s.trim() ? Number(s) : undefined;
    const episodeNum = e.trim() ? Number(e) : undefined;
    const searchQuery: SearchQuery = {
      query: q.trim(),
      languages,
      season: seasonNum !== undefined && !Number.isNaN(seasonNum) ? seasonNum : undefined,
      episode: episodeNum !== undefined && !Number.isNaN(episodeNum) ? episodeNum : undefined,
    };

    try {
      const response = await sendMessage<{ success?: boolean; data?: SearchResponse; error?: string }>({
        type: MESSAGE_TYPES.SEARCH_SUBTITLES,
        payload: searchQuery,
      });

      if (controller.signal.aborted) return;

      if (!response || !response.success) {
        setError(response?.error ?? 'Search failed');
        setResults([]);
      } else if (response.data?.error) {
        setError(describeError(response.data.error));
        setResults([]);
      } else {
        setResults(response.data?.results ?? []);
        setError(null);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Debounced search on query/language/season/episode change.
  useEffect(() => {
    const trimmed = query.trim();
    // Only auto-search if query changed (not on lang/S/E change alone).
    if (trimmed === lastQueryRef.current && lastQueryRef.current !== '') return;
    lastQueryRef.current = trimmed;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doSearch(query, language, season, episode);
    }, DEBOUNCE_MS);

    return (): void => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, language, season, episode, doSearch]);

  // Cleanup abort controller on unmount.
  useEffect(() => {
    return (): void => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSearchClick = useCallback((): void => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void doSearch(query, language, season, episode);
  }, [query, language, season, episode, doSearch]);

  const handleResultClick = useCallback(async (index: number): Promise<void> => {
    // Toggle off if same result clicked again.
    if (selectedResult === index) {
      setSelectedResult(null);
      setPreviewCues(null);
      setPreviewError(null);
      return;
    }
    setSelectedResult(index);
    setPreviewCues(null);
    setPreviewError(null);

    const result = results[index];
    if (!result) return;

    // Cache hit — show cached cues immediately.
    const cached = previewCacheRef.current.get(result.id);
    if (cached) {
      setPreviewCues(cached);
      return;
    }

    // Fetch + parse subtitle for preview.
    setPreviewLoading(true);
    try {
      const response = await sendMessage<{ success?: boolean; data?: ResolveSubtitleDownloadResult; error?: string }>({
        type: MESSAGE_TYPES.RESOLVE_SUBTITLE_DOWNLOAD,
        payload: { result, role: 'target' },
      });
      if (!response?.success || !response.data?.content) {
        const msg = response?.error ?? response?.data?.error?.type ?? 'download failed';
        setPreviewError(msg);
        return;
      }
      const parsed = parseSubtitle(response.data.content, response.data.format ?? result.format);
      if (!parsed.success || parsed.cues.length === 0) {
        setPreviewError(parsed.error ?? 'no cues');
        return;
      }
      previewCacheRef.current.set(result.id, parsed.cues);
      setPreviewCues(parsed.cues);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedResult, results]);

  const handleRolePick = useCallback(
    (result: SubtitleSearchResult, role: 'target' | 'native'): void => {
      const cachedCues = previewCacheRef.current.get(result.id);
      onSearchResultSelect(result, role, cachedCues);
      setSelectedResult(null);
      setPreviewCues(null);
    },
    [onSearchResultSelect],
  );

  const handleRetry = useCallback((): void => {
    void doSearch(query, language, season, episode);
  }, [query, language, season, episode, doSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        void doSearch(query, language, season, episode);
      }
    },
    [query, language, season, episode, doSearch],
  );

  // No keys → inline ApiKeyManager so user can add keys without leaving search view.
  if (!hasSearchKeys) {
    return (
      <section className={styles.noKeySection} data-cell-id="search-no-keys">
        <p className={styles.noKeyHint}>Add an API key to search subtitles from SubDL or OpenSubtitles.</p>
        <ApiKeyManager keys={[...apiKeys]} onChange={onApiKeysChange} />
      </section>
    );
  }

  const languageOptions = [
    { value: ALL_LANGUAGES_VALUE, label: 'All languages' },
    ...LANGUAGES.map((l) => ({
      value: l.iso1,
      label: l.native === l.english ? l.english : `${l.native} (${l.english})`,
    })),
  ];

  return (
    <section className={styles.section} data-cell-id="search-section">
      <div className={styles.sectionHead} data-cell-id="search-section-header">
        <span className={styles.sectionTitle}>Search subtitles</span>
      </div>

      <div className={styles.searchForm} data-cell-id="search-form">
        <div className={styles.inputRow}>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Movie or series title…"
            aria-label="Search subtitles by title"
            className={styles.queryInput}
            data-cell-id="search-query-input"
          />
          <Select
            value={language}
            options={languageOptions}
            onChange={setLanguage}
            aria-label="Search language"
            className={styles.langSelect}
            data-cell-id="search-language-select"
          />
        </div>

        <div className={styles.seasonRow}>
          <label className={styles.numberField}>
            <span className={styles.numberLabel}>Season</span>
            <Input
              type="number"
              min={1}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              aria-label="Season number"
              className={styles.numberInput}
              data-cell-id="search-season-input"
            />
          </label>
          <label className={styles.numberField}>
            <span className={styles.numberLabel}>Episode</span>
            <Input
              type="number"
              min={1}
              value={episode}
              onChange={(e) => setEpisode(e.target.value)}
              aria-label="Episode number"
              className={styles.numberInput}
              data-cell-id="search-episode-input"
            />
          </label>
          <Button
            variant="primary"
            size="md"
            loading={loading}
            onClick={handleSearchClick}
            disabled={!query.trim()}
            className={styles.searchButton}
            data-cell-id="search-button"
          >
            Search
          </Button>
        </div>
      </div>

      <div className={styles.resultsArea} data-cell-id="search-results-area">
        {loading && (
          <ul className={styles.skeletonList} aria-hidden="true">
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <li key={i} className={styles.skeletonItem}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="40%" height={12} />
              </li>
            ))}
          </ul>
        )}

        {!loading && error && (
          <div className={styles.errorState} role="alert" data-cell-id="search-error">
            <span className={styles.errorText}>{error}</span>
            <Button variant="outline" size="sm" onClick={handleRetry} data-cell-id="search-retry">
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <div className={styles.emptyState} data-cell-id="search-empty">
            No results found
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <ul className={styles.resultsList} role="listbox" data-cell-id="search-results-list">
            {results.map((result, index) => (
              <SearchResultRow
                key={result.id}
                result={result}
                index={index}
                isSelected={selectedResult === index}
                previewCues={selectedResult === index ? previewCues : null}
                previewLoading={selectedResult === index ? previewLoading : false}
                previewError={selectedResult === index ? previewError : null}
                onSelect={() => void handleResultClick(index)}
                onRolePick={(role) => handleRolePick(result, role)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
