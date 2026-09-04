/**
 * SubtitleSearchPanel — search UI for SubDL / OpenSubtitles.
 *
 * Renders as a dedicated view inside SubtitleManagerPanel (with back button).
 * Search triggers only on Enter or Search button click — no auto-search.
 * Language is read-only from settings (target → native), no language select.
 *
 * Mobile-first layout:
 * - Search input full-width with leading search icon + clear button
 * - Season/Episode collapsed under "Advanced" toggle (progressive disclosure)
 * - API key hint replaces status chip (actionable empty state)
 * - Target/Native tabs filter results, shown only after search
 * - Clicking a result loads it directly into the overlay
 *
 * Spec: docs/specs/subtitle-search.md — UI Design section.
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Input } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Tabs } from '@/shared/ui';
import {
  Captions,
  Search,
  SlidersHorizontal,
  Wrench,
  X,
} from 'lucide-react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { LANGUAGES } from '@/shared/config/languageRegistry';
import { ApiKeyManager } from '@/features/settings/ui/ApiKeyManager';
import type { SubtitleSearchResult, SearchQuery, SearchError } from '../logic/subtitleSearchTypes';
import type { SubtitleApiKey } from '@/entities/settings';
import styles from './SubtitleSearchPanel.module.css';

export interface SubtitleSearchPanelProps {
  readonly hasSearchKeys: boolean;
  readonly apiKeys: readonly SubtitleApiKey[];
  readonly onApiKeysChange: (keys: SubtitleApiKey[]) => void;
  readonly onSearchResultSelect: (result: SubtitleSearchResult, role: 'target' | 'native') => void;
  /** Showcase-only: bypasses sendMessage with mock results for testing. */
  readonly mockResults?: readonly SubtitleSearchResult[];
}

type SubtitleRole = 'target' | 'native';

const SKELETON_COUNT = 4;

interface SearchResponse {
  readonly results?: SubtitleSearchResult[];
  readonly error?: SearchError;
}

function languageLabel(iso: string): string {
  const entry = LANGUAGES.find((l) => l.iso1 === iso);
  if (!entry) return iso;
  return entry.native === entry.english ? entry.english : `${entry.native} (${entry.english})`;
}

function languageShortLabel(iso: string): string {
  const entry = LANGUAGES.find((l) => l.iso1 === iso);
  return entry ? (entry.native === entry.english ? entry.english : entry.native) : iso;
}

function describeError(err: SearchError): string {
  switch (err.type) {
    case 'no-key':
      return `No API key for ${err.provider}. Add one in API keys.`;
    case 'quota-exhausted':
      return `All ${err.provider} keys exhausted. Add more in API keys.`;
    case 'rate-limited':
      return `${err.provider} rate-limited. Try again in ${Math.ceil(err.retryAfterMs / 1000)}s.`;
    case 'auth-invalid':
      return `${err.provider} key invalid. Check API keys.`;
    case 'network':
      return `Network error: ${err.message}`;
    case 'parse':
      return `Parse error: ${err.message}`;
  }
}

function SearchResultRow({ result, index, onClick }: {
  readonly result: SubtitleSearchResult;
  readonly index: number;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <li className={styles.resultItem} role="option" data-cell-id={`search-result-${index}`}>
      <Button material="liquid" variant="secondary"
        className={styles.resultButton}
        onClick={onClick}
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
      </Button>
    </li>
  );
}

export function SubtitleSearchPanel({ hasSearchKeys, apiKeys, onApiKeysChange, onSearchResultSelect, mockResults }: SubtitleSearchPanelProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [targetLang, setTargetLang] = useState('');
  const [nativeLang, setNativeLang] = useState('');
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [results, setResults] = useState<readonly SubtitleSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manageKeysOpen, setManageKeysOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SubtitleRole>('target');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const settings = await loadSettings();
        setTargetLang(settings.subtitleOverlayTargetLanguage ?? '');
        setNativeLang(settings.subtitleOverlayNativeLanguage ?? '');
      } catch {
        // Settings load failure — empty langs = search all.
      }
    })();
  }, []);

  const searchLanguages = useCallback((): readonly string[] => {
    return [targetLang, nativeLang].filter(Boolean);
  }, [targetLang, nativeLang]);

  const doSearch = useCallback(async (q: string, langs: readonly string[], s: string, e: string): Promise<void> => {
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

    const seasonNum = s.trim() ? Number(s) : undefined;
    const episodeNum = e.trim() ? Number(e) : undefined;
    const searchQuery: SearchQuery = {
      query: q.trim(),
      languages: [...langs],
      season: seasonNum !== undefined && !Number.isNaN(seasonNum) ? seasonNum : undefined,
      episode: episodeNum !== undefined && !Number.isNaN(episodeNum) ? episodeNum : undefined,
    };

    try {
      if (mockResults) {
        await new Promise((r) => setTimeout(r, 600));
        if (controller.signal.aborted) return;
        setResults(mockResults);
        setError(null);
        return;
      }
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
  }, [mockResults]);

  // Cleanup abort controller on unmount.
  useEffect(() => {
    return (): void => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSearchClick = useCallback((): void => {
    void doSearch(query, searchLanguages(), season, episode);
  }, [query, season, episode, doSearch, searchLanguages]);

  const handleResultClick = useCallback((result: SubtitleSearchResult): void => {
    onSearchResultSelect(result, activeTab);
  }, [activeTab, onSearchResultSelect]);

  const handleRetry = useCallback((): void => {
    void doSearch(query, searchLanguages(), season, episode);
  }, [query, season, episode, doSearch, searchLanguages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void doSearch(query, searchLanguages(), season, episode);
      }
    },
    [query, season, episode, doSearch, searchLanguages],
  );

  const handleClearQuery = useCallback((): void => {
    setQuery('');
    setResults([]);
    setError(null);
    setHasSearched(false);
  }, []);

  const formDisabled = !hasSearchKeys;

  // Filter results by active tab's language.
  const tabLang = activeTab === 'target' ? targetLang : nativeLang;
  const filteredResults = useMemo(() => {
    if (!tabLang) return results;
    return results.filter((r) => r.isoLanguage === tabLang);
  }, [results, tabLang]);

  // Tab labels with language names.
  const targetLabel = targetLang ? languageShortLabel(targetLang) : 'Target';
  const nativeLabel = nativeLang ? languageShortLabel(nativeLang) : 'Native';

  return (
    <section className={styles.section} data-cell-id="search-section">
      {/* Search row — Manage keys (left) + search bar (input + clear + search inside) + Advanced (right) */}
      <div className={styles.searchInputWrap} data-cell-id="search-input-wrap">
        {hasSearchKeys && (
          <IconButton material="liquid"
            variant="ghost"
            size="md"
            active={manageKeysOpen}
            onClick={() => setManageKeysOpen((v) => !v)}
            aria-expanded={manageKeysOpen}
            aria-label="Manage API keys"
            data-cell-id="search-manage-keys-toggle"
          >
            <Wrench aria-hidden="true" />
          </IconButton>
        )}
        <div className={styles.searchBar} data-cell-id="search-bar">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Movie or series title…"
            aria-label="Search subtitles by title"
            className={styles.searchInput}
            disabled={formDisabled}
            data-cell-id="search-query-input"
          />
          <div className={styles.searchActions}>
            {query && (
              <IconButton material="liquid"
                variant="ghost"
                size="md"
                onClick={handleClearQuery}
                aria-label="Clear search"
                data-cell-id="search-clear"
              >
                <X aria-hidden="true" />
              </IconButton>
            )}
            <IconButton material="liquid"
              variant="ghost"
              size="md"
              onClick={handleSearchClick}
              disabled={formDisabled || !query.trim() || loading}
              aria-label="Search subtitles"
              data-cell-id="search-button"
            >
              <Search aria-hidden="true" />
            </IconButton>
          </div>
        </div>
        <IconButton material="liquid"
          variant="ghost"
          size="md"
          active={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          aria-label="Advanced search options (season, episode)"
          data-cell-id="search-advanced-toggle"
        >
          <SlidersHorizontal aria-hidden="true" />
        </IconButton>
      </div>

      {advancedOpen && (
        <div className={styles.advancedBody} data-cell-id="search-advanced-body">
          <label className={styles.numberField}>
            <span className={styles.numberLabel}>Season</span>
            <Input
              type="number"
              min={1}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              aria-label="Season number"
              className={styles.numberInput}
              disabled={formDisabled}
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
              disabled={formDisabled}
              data-cell-id="search-episode-input"
            />
          </label>
        </div>
      )}

      {/* API key hint — replaces status chip, actionable when no keys */}
      {!hasSearchKeys && (
        <div className={styles.apiHint} data-cell-id="search-api-hint">
          <Wrench className={styles.apiHintIcon} aria-hidden="true" />
          <span className={styles.apiHintText}>Add an API key to start searching</span>
          <Button material="liquid"
            variant="primary"
            size="sm"
            onClick={() => setManageKeysOpen((v) => !v)}
            aria-expanded={manageKeysOpen}
            data-cell-id="search-manage-keys-toggle"
          >
            {manageKeysOpen ? 'Hide' : 'Add key'}
          </Button>
        </div>
      )}

      {manageKeysOpen && (
        <div className={styles.manageKeysPanel} data-cell-id="search-manage-keys">
          <ApiKeyManager keys={[...apiKeys]} onChange={onApiKeysChange} />
        </div>
      )}

      {/* Target / Native tabs — filter results by language, only after search */}
      {hasSearched && !loading && !error && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SubtitleRole)}>
          <Tabs.List data-cell-id="search-tabs" role="tablist">
            <Tabs.Trigger value="target" data-cell-id="search-tab-target">
              <span>{targetLabel}</span>
              {activeTab === 'target' && filteredResults.length > 0 && (
                <span className={styles.tabCount}>{filteredResults.length}</span>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value="native" data-cell-id="search-tab-native">
              <span>{nativeLabel}</span>
              {activeTab === 'native' && filteredResults.length > 0 && (
                <span className={styles.tabCount}>{filteredResults.length}</span>
              )}
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      )}

      <div className={styles.resultsArea} data-cell-id="search-results-area">
        {/* Hint + icon — fills empty space before search, hidden when manage keys open */}
        {!loading && !error && !hasSearched && hasSearchKeys && !manageKeysOpen && (
          <div className={styles.hintState} data-cell-id="search-hint">
            <Captions className={styles.hintIcon} aria-hidden="true" />
            <span className={styles.hintText}>Search for subtitles by movie or series title</span>
          </div>
        )}

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
            <Button material="liquid" variant="outline" size="sm" onClick={handleRetry} data-cell-id="search-retry">
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && hasSearched && filteredResults.length === 0 && (
          <div className={styles.emptyState} data-cell-id="search-empty">
            {results.length > 0
              ? `No ${languageLabel(tabLang)} subtitles found. Try the other tab.`
              : 'No results found'}
          </div>
        )}

        {!loading && !error && filteredResults.length > 0 && (
          <ul className={styles.resultsList} role="listbox" data-cell-id="search-results-list">
            {filteredResults.map((result, index) => (
              <SearchResultRow
                key={result.id}
                result={result}
                index={index}
                onClick={() => handleResultClick(result)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
