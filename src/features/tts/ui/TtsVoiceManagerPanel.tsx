// TtsVoiceManagerPanel — options page tab "TTS Voices" (spec popup-dictionary-4tab-logic, T14+T15).
//
// 2 cards matching project-reference/theocean-extension-dictionary/options.html:
//   Card 1 (Settings): enable toggle, maxDisplay select, 3-slot voice selection,
//     autoplay select. Save → settings.tts.voices: string[] (3 priority slots).
//   Card 2 (Tester): sentence textarea, country filter, voice list with
//     drag-drop reorder + checkbox select + play + order input. Save →
//     settings.tts.savedVoices: {voiceName, lang, order}[] (checked only).

import { useState, useEffect, useCallback, useMemo, useRef, type ReactElement, type DragEvent } from 'react';
import { Button, IconButton } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import { createTtsEngine, type TtsVoiceInfo } from '@/features/dictionaryPopup/services/ttsEngineService';
import type { TtsSettings, TtsVoiceRow } from '@/entities/settings/types';
import styles from './TtsVoiceManagerPanel.module.css';

/** Default TTS settings — used when settings.tts is absent (schema defaults). */
export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  enabled: true,
  savedVoices: [],
  voices: [],
  maxDisplay: 3,
  autoplayCount: 0,
  preferredAccent: 'US',
};

interface TtsVoiceManagerPanelProps {
  readonly settings: TtsSettings;
  readonly onSave: (tts: TtsSettings) => void;
}

/** Tester row — a voice with selection + order state for the tester card. */
interface TesterVoiceRow {
  readonly voiceName: string;
  readonly lang: string;
  readonly order: number;
  readonly selected: boolean;
}

const SLOT_COUNT = 3;

/** Extract the lang prefix (e.g. "en" from "en-US") for country filtering. */
function langPrefix(lang: string): string {
  return lang.split('-')[0] ?? lang;
}

/** Build unique sorted lang prefixes from a voice list. */
function uniqueLangPrefixes(voices: readonly TtsVoiceInfo[]): string[] {
  const set = new Set<string>();
  for (const v of voices) set.add(langPrefix(v.lang));
  return Array.from(set).sort();
}

export function TtsVoiceManagerPanel({ settings, onSave }: TtsVoiceManagerPanelProps): ReactElement {
  const [voices, setVoices] = useState<TtsVoiceInfo[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Card 1 — 3-slot selection state (length 3, nullable voiceName).
  const [voices3Slot, setVoices3Slot] = useState<(string | null)[]>(() =>
    padSlots(settings.voices),
  );
  const [enabled, setEnabled] = useState(settings.enabled);
  const [maxDisplay, setMaxDisplay] = useState(settings.maxDisplay);
  const [autoplayCount, setAutoplayCount] = useState(settings.autoplayCount);

  // Card 2 — tester state.
  const [testText, setTestText] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [testerVoices, setTesterVoices] = useState<TesterVoiceRow[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // Re-sync local state when settings prop changes (e.g. after save round-trip).
  useEffect(() => {
    setVoices3Slot(padSlots(settings.voices));
    setEnabled(settings.enabled);
    setMaxDisplay(settings.maxDisplay);
    setAutoplayCount(settings.autoplayCount);
  }, [settings]);

  // Load voices on mount via the best available TTS engine.
  // Pre-select savedVoices (settings.tts.savedVoices) so reopening options
  // shows the previously-saved tester selection instead of a blank list.
  useEffect(() => {
    let cancelled = false;
    setVoicesLoading(true);
    createTtsEngine()
      .getVoices()
      .then((list) => {
        if (cancelled) return;
        setVoices([...list]);
        const savedVoiceMap = new Map(
          settings.savedVoices.map((r) => [r.voiceName, r.order]),
        );
        setTesterVoices(
          list.map((v, i) => ({
            voiceName: v.voiceName,
            lang: v.lang,
            order: savedVoiceMap.get(v.voiceName) ?? i + 1,
            selected: savedVoiceMap.has(v.voiceName),
          })),
        );
        setVoicesLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(`Không thể tải danh sách giọng đọc: ${String(e)}`);
        setVoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.savedVoices]);

  const countries = useMemo(() => uniqueLangPrefixes(voices), [voices]);

  const filteredTesterVoices = useMemo(() => {
    const rows = countryFilter
      ? testerVoices.filter((r) => langPrefix(r.lang) === countryFilter)
      : testerVoices;
    return rows.slice().sort((a, b) => a.order - b.order);
  }, [testerVoices, countryFilter]);

  const selectedCount = testerVoices.filter((r) => r.selected).length;

  // --- Card 1: 3-slot selection ---

  const handleSlotChange = useCallback((voiceName: string, slotIndex: number) => {
    setVoices3Slot((prev) => {
      const next = [...prev] as (string | null)[];
      // Toggle off if same voice already in this slot.
      if (next[slotIndex] === voiceName) {
        next[slotIndex] = null;
        return next;
      }
      // Clear this voice from any other slot it occupies.
      for (let i = 0; i < next.length; i++) {
        if (next[i] === voiceName) next[i] = null;
      }
      next[slotIndex] = voiceName;
      return next;
    });
  }, []);

  const handleSaveSlots = useCallback(() => {
    onSave({
      ...settings,
      enabled,
      maxDisplay,
      autoplayCount,
      voices: voices3Slot.filter((v): v is string => Boolean(v)),
    });
    setStatusMsg('Đã lưu cài đặt TTS.');
  }, [onSave, settings, enabled, maxDisplay, autoplayCount, voices3Slot]);

  const handlePlayVoice = useCallback(async (voiceName: string) => {
    const text = testText.trim() || 'Hello, this is a text-to-speech test.';
    try {
      setPlaying(true);
      await createTtsEngine().speak(text, { voiceName });
    } catch (e: unknown) {
      setStatusMsg(`Lỗi phát âm thanh: ${String(e)}`);
    } finally {
      setPlaying(false);
    }
  }, [testText]);

  // --- Card 2: tester ---

  const handleToggleSelected = useCallback((voiceName: string) => {
    setTesterVoices((prev) =>
      prev.map((r) => (r.voiceName === voiceName ? { ...r, selected: !r.selected } : r)),
    );
  }, []);

  const handleOrderChange = useCallback((voiceName: string, order: number) => {
    if (!Number.isFinite(order) || order < 1) return;
    setTesterVoices((prev) =>
      prev.map((r) => (r.voiceName === voiceName ? { ...r, order } : r)),
    );
  }, []);

  const dragVoiceRef = useRef<string | null>(null);

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    // Store the dragged voiceName (not the filtered index) so the drop
    // handler can resolve the correct position in the full array even when
    // a country filter is active (filtered index ≠ full array index).
    dragVoiceRef.current = filteredTesterVoices[index]?.voiceName ?? null;
    e.dataTransfer.effectAllowed = 'move';
  }, [filteredTesterVoices]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    const draggingVoice = dragVoiceRef.current;
    const targetVoice = filteredTesterVoices[dropIndex]?.voiceName;
    dragVoiceRef.current = null;
    if (!draggingVoice || !targetVoice || draggingVoice === targetVoice) return;
    setTesterVoices((prev) => {
      // Operate on the order-sorted full array, mapping filtered positions
      // to full-array positions by voiceName. Splicing on the filtered list
      // with filtered indices corrupts order when a filter is active.
      const sorted = prev.slice().sort((a, b) => a.order - b.order);
      const fullFromIdx = sorted.findIndex((v) => v.voiceName === draggingVoice);
      const fullToIdx = sorted.findIndex((v) => v.voiceName === targetVoice);
      if (fullFromIdx < 0 || fullToIdx < 0) return prev;
      const [moved] = sorted.splice(fullFromIdx, 1);
      sorted.splice(fullToIdx, 0, moved);
      return sorted.map((r, i) => ({ ...r, order: i + 1 }));
    });
  }, [filteredTesterVoices]);

  const handleDeleteSelection = useCallback(() => {
    setTesterVoices((prev) => prev.map((r) => ({ ...r, selected: false })));
  }, []);

  const handlePlayAll = useCallback(async () => {
    const text = testText.trim() || 'Hello, this is a text-to-speech test.';
    const selected = testerVoices
      .filter((r) => r.selected)
      .slice()
      .sort((a, b) => a.order - b.order);
    if (selected.length === 0) {
      setStatusMsg('Chọn ít nhất một giọng để phát.');
      return;
    }
    const engine = createTtsEngine();
    setPlaying(true);
    try {
      for (const row of selected) {
        await engine.speak(text, { voiceName: row.voiceName });
      }
    } catch (e: unknown) {
      setStatusMsg(`Lỗi phát âm thanh: ${String(e)}`);
    } finally {
      setPlaying(false);
    }
  }, [testText, testerVoices]);

  const handleSaveVoiceList = useCallback(() => {
    const saved: TtsVoiceRow[] = testerVoices
      .filter((r) => r.selected)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((r, i) => ({ voiceName: r.voiceName, lang: r.lang, order: i + 1 }));
    onSave({ ...settings, savedVoices: saved });
    setStatusMsg(`Đã lưu ${saved.length} giọng đọc.`);
  }, [onSave, settings, testerVoices]);

  return (
    <div className={styles.panel} data-testid="tts-voice-manager">
      {loadError && <div className={styles.error} role="alert">{loadError}</div>}
      {statusMsg && <div className={styles.status} role="status">{statusMsg}</div>}

      {/* === Card 1: TTS Settings === */}
      <section className={styles.card}>
        <header className={styles.card__header}>
          <h2 className={styles.card__title}>Text-to-Speech (TTS)</h2>
        </header>
        <div className={styles.card__body}>
          <div className={styles.row}>
            <div className={styles.row__label}>Enable TTS</div>
            <div className={styles.row__control}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                data-testid="tts-enabled"
              />
              <span>Read example sentence</span>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.row__label}>Show buttons</div>
            <div className={styles.row__control}>
              <select
                value={maxDisplay}
                onChange={(e) => setMaxDisplay(Number(e.target.value))}
                data-testid="tts-max-display"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          </div>

          <div className={`${styles.row} ${styles.rowFlex}`}>
            <div className={styles.row__label}>Voice selection</div>
            <div className={styles.row__control}>
              {voicesLoading ? (
                <p className={styles.muted}>Đang tải danh sách giọng đọc…</p>
              ) : voices.length === 0 ? (
                <p className={styles.muted}>Không có giọng đọc nào.</p>
              ) : (
                <div className={styles.voiceSelectionList} role="list" data-testid="tts-voice-selection">
                  {voices.map((v) => (
                    <div className={styles.voiceSelectionItem} key={v.voiceName}>
                      <IconButton
                        size="sm"
                        onClick={() => void handlePlayVoice(v.voiceName)}
                        disabled={playing}
                        aria-label={`Phát giọng ${v.voiceName}`}
                      >
                        <Icon name="play" size={16} />
                      </IconButton>
                      <div className={styles.voiceSelectionSlots}>
                        {[0, 1, 2].map((slot) => (
                          <label key={slot} className={styles.slotRadio}>
                            <input
                              type="radio"
                              name={`voice-slot-${v.voiceName}`}
                              checked={voices3Slot[slot] === v.voiceName}
                              onChange={() => handleSlotChange(v.voiceName, slot)}
                            />
                            <span>{slot + 1}</span>
                          </label>
                        ))}
                      </div>
                      <span className={styles.voiceName}>{v.voiceName}</span>
                      <span className={styles.voiceLang}>{v.lang}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.row__label}>Autoplay</div>
            <div className={styles.row__control}>
              <select
                value={autoplayCount}
                onChange={(e) => setAutoplayCount(Number(e.target.value))}
                data-testid="tts-autoplay"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          </div>

          <div className={styles.actions}>
            <Button variant="primary" onClick={handleSaveSlots} data-testid="tts-save-settings">
              Save settings
            </Button>
          </div>
        </div>
      </section>

      {/* === Card 2: TTS Tester === */}
      <section className={`${styles.card} ${styles.ttsTester}`}>
        <header className={styles.card__header}>
          <h2 className={styles.card__title}>TTS Tester</h2>
        </header>
        <div className={styles.card__body}>
          <div className={styles.row}>
            <div className={styles.row__label}>Sentence</div>
            <div className={styles.row__control}>
              <textarea
                rows={2}
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Type a sentence to test"
                data-testid="tts-test-text"
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.row__label}>Filter by country</div>
            <div className={styles.row__control}>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                data-testid="tts-country-filter"
              >
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={`${styles.row} ${styles.rowFlex}`}>
            <div className={styles.row__label}>Voices</div>
            <div className={styles.row__control}>
              <div className={styles.ttsHeader}>
                <Button
                  variant="secondary"
                  onClick={handleDeleteSelection}
                  data-testid="tts-clear-selection"
                >
                  Delete selection ({selectedCount})
                </Button>
                <div className={styles.ttsHeader__actions}>
                  <Button
                    variant="primary"
                    onClick={() => void handlePlayAll()}
                    loading={playing}
                    data-testid="tts-play-all"
                  >
                    Play all audios
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSaveVoiceList}
                    data-testid="tts-save-voice-list"
                  >
                    Save TTS voice list
                  </Button>
                </div>
              </div>
              <div className={styles.voiceList} role="list" data-testid="tts-voice-list">
                {filteredTesterVoices.map((row, index) => (
                  <div
                    className={styles.voiceItem}
                    key={row.voiceName}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <span className={styles.dragHandle} aria-hidden="true">⠿</span>
                    <input
                      type="number"
                      className={styles.orderInput}
                      value={row.order}
                      min={1}
                      onChange={(e) => handleOrderChange(row.voiceName, Number(e.target.value))}
                      aria-label="Thứ tự"
                    />
                    <button
                      type="button"
                      className={styles.voicePlayBtn}
                      onClick={() => void handlePlayVoice(row.voiceName)}
                      disabled={playing}
                      aria-label={`Phát giọng ${row.voiceName}`}
                    >
                      <Icon name="play" size={16} />
                    </button>
                    <label className={styles.voiceCheckbox}>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => handleToggleSelected(row.voiceName)}
                      />
                      <span className={styles.voiceName}>{row.voiceName}</span>
                      <span className={styles.voiceLang}>{row.lang}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Pad a voices string array to exactly SLOT_COUNT nullable slots. */
function padSlots(voices: readonly string[]): (string | null)[] {
  const slots: (string | null)[] = [null, null, null];
  for (let i = 0; i < Math.min(voices.length, SLOT_COUNT); i++) {
    slots[i] = voices[i] ?? null;
  }
  return slots;
}
