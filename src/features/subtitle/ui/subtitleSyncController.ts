import { formatSubtitleName } from '@/features/subtitle/logic/subtitleNaming';
import type { ParsedFile } from '@/features/subtitle/logic/subtitleImport';
import type { SubtitleSearchResult } from '@/features/subtitle/logic/subtitleSearchTypes';
import type { SrtCue } from '@/entities/media';
import type { Settings } from '@/entities/media';
import type { SubtitleForOverlayResult } from '@/entities/message';
import type { SubtitlePanelItem } from './subtitlePanelModel';
import type { ReactSubtitleController } from './reactSubtitleController';

/**
 * Dependencies injected by contentScriptController. Most are placeholders
 * for future callbacks; the sync controller itself is side-effect-free and
 * returns decisions for the caller to act on.
 */
export interface SubtitleSyncControllerDeps {
  getBlockController: () => ReactSubtitleController | null;
  showOverlay: () => void;
  syncSidePanelFromBlock: () => void;
  getContainer: () => HTMLElement;
  getCurrentSettings: () => Settings | null;
}

/** Generate-native virtual replacement slot in the native manager panel. */
export interface TranslatedNativeSlot {
  readonly replacedSource: 'auto' | 'imported' | null;
  readonly replacedIndex: number;
  readonly item: SubtitlePanelItem;
  cues: SrtCue[];
  readonly runId: number;
}

/** OCR dual-stream virtual slot for one role. */
export interface OcrTrackSlot {
  readonly item: SubtitlePanelItem;
  cues: SrtCue[];
}

/** Snapshot of active sources taken before the first OCR tracks message. */
export interface PreOcrSources {
  target: 'auto' | 'imported' | 'searched' | 'ocr';
  native: 'auto' | 'imported' | 'translated' | 'searched' | 'ocr';
}

/**
 * Owns runtime subtitle source/cue sync state for the content script.
 *
 * - Tracks active source, latest cues, panel indices.
 * - Builds merged manager panel items from auto/imported/searched/translated/ocr.
 * - Provides source selection helpers and cue resolution.
 *
 * Side effects (blockController calls, toasts, overlay, broadcast) are left to
 * contentScriptController; this class only holds state and returns decisions.
 */
export class SubtitleSyncController {
  public deps: SubtitleSyncControllerDeps | undefined;

  // Latest loaded cues (used for generate-native and auto source resolution)
  public latestTargetCues: SrtCue[] = [];
  public latestNativeCues: SrtCue[] = [];

  // Auto-detected matches and the panel items derived from them
  public targetMatches: SubtitleForOverlayResult[] = [];
  public nativeMatches: SubtitleForOverlayResult[] = [];
  public activeTargetIndex = 0;
  public activeNativeIndex = 0;
  public autoTargetItems: SubtitlePanelItem[] = [];
  public autoNativeItems: SubtitlePanelItem[] = [];

  // Imported files and panel items
  public importedTargetItems: SubtitlePanelItem[] = [];
  public importedNativeItems: SubtitlePanelItem[] = [];
  public activeImportTargetIndex = 0;
  public activeImportNativeIndex = 0;
  public importedParsedTarget: ParsedFile[] = [];
  public importedParsedNative: ParsedFile[] = [];

  // Searched subtitle panel items and parsed cue cache
  public searchedTargetItems: SubtitlePanelItem[] = [];
  public searchedNativeItems: SubtitlePanelItem[] = [];
  public activeSearchedTargetIndex = 0;
  public activeSearchedNativeIndex = 0;
  public parsedSearchCache = new Map<string, SrtCue[]>();

  // Active source per role
  public activeTargetSource: 'auto' | 'imported' | 'searched' | 'ocr' = 'auto';
  public activeNativeSource: 'auto' | 'imported' | 'translated' | 'searched' | 'ocr' = 'auto';

  // Virtual replacement slots
  public translatedNativeSlot: TranslatedNativeSlot | null = null;
  public ocrTargetSlot: OcrTrackSlot | null = null;
  public ocrNativeSlot: OcrTrackSlot | null = null;
  public preOcrSources: PreOcrSources | null = null;

  constructor(deps?: SubtitleSyncControllerDeps) {
    this.deps = deps;
  }

  // === Latest cues ===

  setLatestTargetCues(cues: SrtCue[]): void {
    this.latestTargetCues = cues;
  }

  setLatestNativeCues(cues: SrtCue[]): void {
    this.latestNativeCues = cues;
  }

  getLatestTargetCues(): SrtCue[] {
    return this.latestTargetCues;
  }

  getLatestNativeCues(): SrtCue[] {
    return this.latestNativeCues;
  }

  // === Auto source ===

  setAutoMatches(target: SubtitleForOverlayResult[], native: SubtitleForOverlayResult[]): void {
    this.targetMatches = target;
    this.nativeMatches = native;

    this.autoTargetItems = target.map((m, i) => ({
      id: `auto-target-${i}`,
      name: formatSubtitleName('auto', m.language, i, undefined, m.displayName),
      format: m.format,
      source: 'auto' as const,
      role: 'target' as const,
      index: i,
      isAsr: m.isAsr,
    }));

    this.autoNativeItems = native.map((m, i) => ({
      id: `auto-native-${i}`,
      name: formatSubtitleName('auto', m.language, i, undefined, m.displayName),
      format: m.format,
      source: 'auto' as const,
      role: 'native' as const,
      index: i,
      isAsr: m.isAsr,
    }));
  }

  setAutoItems(target: SubtitlePanelItem[], native: SubtitlePanelItem[]): void {
    this.autoTargetItems = target;
    this.autoNativeItems = native;
  }

  getAutoMatch(role: 'target' | 'native', index: number): SubtitleForOverlayResult | undefined {
    return role === 'target' ? this.targetMatches[index] : this.nativeMatches[index];
  }

  /**
   * Set both target and native auto cues (used by auto-load).
   */
  setAutoCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void;
  /**
   * Set cues for a single auto selection and reset related state.
   */
  setAutoCues(role: 'target' | 'native', index: number, cues: SrtCue[]): void;
  setAutoCues(
    roleOrTarget: 'target' | 'native' | SrtCue[],
    indexOrNative?: number | SrtCue[],
    cues?: SrtCue[],
  ): void {
    if (Array.isArray(roleOrTarget)) {
      this.latestTargetCues = roleOrTarget;
      this.latestNativeCues = indexOrNative as SrtCue[];
      this.activeTargetSource = 'auto';
      this.activeNativeSource = 'auto';
      this.clearTranslatedNativeState();
      return;
    }

    const role = roleOrTarget;
    const index = indexOrNative as number;
    const cueList = cues as SrtCue[];

    if (role === 'target') {
      this.activeTargetIndex = index;
      this.activeTargetSource = 'auto';
      this.latestTargetCues = cueList;
      this.clearTranslatedNativeState();
      this.activeNativeSource = 'auto';
      this.activeNativeIndex = 0;
    } else {
      this.activeNativeIndex = index;
      this.activeNativeSource = 'auto';
      this.latestNativeCues = cueList;
    }
  }

  selectAuto(role: 'target' | 'native', index: number): void {
    if (role === 'target') {
      this.activeTargetIndex = index;
      this.activeTargetSource = 'auto';
      this.clearTranslatedNativeState();
      this.activeNativeSource = 'auto';
      this.activeNativeIndex = 0;
    } else {
      this.activeNativeIndex = index;
      this.activeNativeSource = 'auto';
    }
  }

  // === Imported source ===

  setImportedItems(target: SubtitlePanelItem[], native: SubtitlePanelItem[]): void {
    this.importedTargetItems = target;
    this.importedNativeItems = native;
  }

  addImportedFiles(target: ParsedFile[], native: ParsedFile[]): {
    targetItemStart: number;
    nativeItemStart: number;
    targetCues: SrtCue[];
    nativeCues: SrtCue[];
  } {
    const existingTargetCount = this.importedParsedTarget.length;
    const existingNativeCount = this.importedParsedNative.length;

    const newTargetItems = target.map((f, i) => ({
      id: `imported-target-${existingTargetCount + i}`,
      name: formatSubtitleName('imported', '', existingTargetCount + i, f.file.name),
      format: f.format,
      size: f.file.size,
      source: 'imported' as const,
      role: 'target' as const,
      index: existingTargetCount + i,
    }));

    const newNativeItems = native.map((f, i) => ({
      id: `imported-native-${existingNativeCount + i}`,
      name: formatSubtitleName('imported', '', existingNativeCount + i, f.file.name),
      format: f.format,
      size: f.file.size,
      source: 'imported' as const,
      role: 'native' as const,
      index: existingNativeCount + i,
    }));

    this.importedParsedTarget = [...this.importedParsedTarget, ...target];
    this.importedParsedNative = [...this.importedParsedNative, ...native];
    this.importedTargetItems = [...this.importedTargetItems, ...newTargetItems];
    this.importedNativeItems = [...this.importedNativeItems, ...newNativeItems];

    if (target.length > 0) {
      this.activeImportTargetIndex = existingTargetCount;
      this.activeTargetSource = 'imported';
    }
    if (native.length > 0) {
      this.activeImportNativeIndex = existingNativeCount;
      this.activeNativeSource = 'imported';
    }

    this.clearTranslatedNativeState();

    if (target.length > 0) this.latestTargetCues = target[0]?.cues ?? [];
    if (native.length > 0) this.latestNativeCues = native[0]?.cues ?? [];

    return {
      targetItemStart: existingTargetCount,
      nativeItemStart: existingNativeCount,
      targetCues: target[0]?.cues ?? [],
      nativeCues: native[0]?.cues ?? [],
    };
  }

  setImportedCues(role: 'target' | 'native', index: number, cues: SrtCue[]): void {
    const parsed = role === 'target' ? this.importedParsedTarget : this.importedParsedNative;
    if (parsed[index]) {
      parsed[index] = { ...parsed[index]!, cues };
    }
  }

  getImportCues(role: 'target' | 'native', index: number): SrtCue[] | undefined {
    const parsed = role === 'target' ? this.importedParsedTarget : this.importedParsedNative;
    return parsed[index]?.cues;
  }

  selectImport(role: 'target' | 'native', index: number): void {
    if (role === 'target') {
      this.activeImportTargetIndex = index;
      this.activeTargetSource = 'imported';
      this.clearTranslatedNativeState();
      this.activeNativeSource = 'auto';
      this.activeNativeIndex = 0;
    } else {
      this.activeImportNativeIndex = index;
      this.activeNativeSource = 'imported';
    }
  }

  // === Searched source ===

  setSearchedItems(target: SubtitlePanelItem[], native: SubtitlePanelItem[]): void {
    this.searchedTargetItems = target;
    this.searchedNativeItems = native;
  }

  setSearchedCues(id: string, cues: SrtCue[]): void {
    this.parsedSearchCache.set(id, cues);
  }

  addSearchedResult(role: 'target' | 'native', result: SubtitleSearchResult, cues: SrtCue[]): SubtitlePanelItem {
    const item: SubtitlePanelItem = {
      id: `searched-${role}-${result.id}`,
      name: result.name,
      format: result.format,
      source: 'searched',
      role,
      index: role === 'target' ? this.searchedTargetItems.length : this.searchedNativeItems.length,
    };

    this.parsedSearchCache.set(result.id, cues);

    if (role === 'target') {
      this.searchedTargetItems = [...this.searchedTargetItems, item];
      this.activeSearchedTargetIndex = item.index;
      this.activeTargetSource = 'searched';
      this.latestTargetCues = cues;
    } else {
      this.searchedNativeItems = [...this.searchedNativeItems, item];
      this.activeSearchedNativeIndex = item.index;
      this.activeNativeSource = 'searched';
      this.clearTranslatedNativeState();
      this.latestNativeCues = cues;
    }

    return item;
  }

  getSearchedCues(role: 'target' | 'native', index: number): SrtCue[] | undefined {
    const items = role === 'target' ? this.searchedTargetItems : this.searchedNativeItems;
    const item = items[index];
    if (!item) return undefined;
    const id = item.id.replace(`searched-${role}-`, '');
    return this.parsedSearchCache.get(id);
  }

  selectSearched(role: 'target' | 'native', index: number): void {
    const items = role === 'target' ? this.searchedTargetItems : this.searchedNativeItems;
    if (index >= items.length) return;

    if (role === 'target') {
      this.activeSearchedTargetIndex = index;
      this.activeTargetSource = 'searched';
      this.clearTranslatedNativeState();
      this.activeNativeSource = 'auto';
      this.activeNativeIndex = 0;
    } else {
      this.activeSearchedNativeIndex = index;
      this.activeNativeSource = 'searched';
      this.clearTranslatedNativeState();
    }
  }

  // === Virtual slots ===

  setTranslatedNativeSlot(slot: TranslatedNativeSlot | null): void {
    this.translatedNativeSlot = slot;
    if (slot) {
      this.activeNativeSource = 'translated';
    }
  }

  setTranslatedNativeCues(cues: SrtCue[]): void {
    if (this.translatedNativeSlot) {
      this.translatedNativeSlot.cues = cues;
      this.latestNativeCues = cues;
    }
  }

  getTranslatedNativeSlot(): TranslatedNativeSlot | null {
    return this.translatedNativeSlot;
  }

  /**
   * Snapshot the target cues/format/size and the native slot replacement
   * position before starting a generate-native run.
   */
  getGenerateNativeSnapshot(): {
    targetCues: SrtCue[];
    targetFormat: string;
    targetSize?: number;
    replacedSource: 'auto' | 'imported' | null;
    replacedIndex: number;
  } {
    const baseNativeItems = [...this.autoNativeItems, ...this.importedNativeItems];

    let replacedSource: 'auto' | 'imported' | null;
    let replacedIndex: number;
    if (this.activeNativeSource === 'translated' && this.translatedNativeSlot) {
      replacedSource = this.translatedNativeSlot.replacedSource;
      replacedIndex = this.translatedNativeSlot.replacedIndex;
    } else if (this.activeNativeSource === 'imported' && this.importedNativeItems.length > 0) {
      replacedSource = 'imported';
      replacedIndex = this.autoNativeItems.length + this.activeImportNativeIndex;
    } else if (this.autoNativeItems.length > 0) {
      replacedSource = 'auto';
      replacedIndex = this.activeNativeIndex;
    } else {
      replacedSource = null;
      replacedIndex = 0;
    }
    replacedIndex = Math.min(Math.max(0, replacedIndex), baseNativeItems.length);

    const targetInfo = this.mergedPanelItems('target');
    const targetItem = targetInfo.items[targetInfo.activeIndex];

    return {
      targetCues: [...this.latestTargetCues],
      targetFormat: targetItem?.format ?? 'srt',
      targetSize: targetItem?.size,
      replacedSource,
      replacedIndex,
    };
  }

  // === OCR source ===

  makeOcrPanelItem(id: string, name: string, role: 'target' | 'native'): SubtitlePanelItem {
    return { id, name, format: 'live', source: 'ocr', role, index: 0 };
  }

  setOcrSlots(target: OcrTrackSlot | null, native: OcrTrackSlot | null): void {
    this.ocrTargetSlot = target;
    this.ocrNativeSlot = native;
  }

  setPreOcrSources(sources: PreOcrSources | null): void {
    this.preOcrSources = sources;
  }

  startOcr(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
    if (!this.ocrTargetSlot || !this.ocrNativeSlot) {
      this.preOcrSources = { target: this.activeTargetSource, native: this.activeNativeSource };
      this.ocrTargetSlot = { item: this.makeOcrPanelItem('ocr-target', 'OCR Target (live)', 'target'), cues: [] };
      this.ocrNativeSlot = { item: this.makeOcrPanelItem('ocr-native', 'OCR Native (live)', 'native'), cues: [] };
    }
    this.ocrTargetSlot.cues = targetCues;
    this.ocrNativeSlot.cues = nativeCues;
    this.activeTargetSource = 'ocr';
    this.activeNativeSource = 'ocr';
    this.latestTargetCues = targetCues;
    this.latestNativeCues = nativeCues;
  }

  updateOcrCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
    if (this.ocrTargetSlot && this.ocrNativeSlot) {
      this.ocrTargetSlot.cues = targetCues;
      this.ocrNativeSlot.cues = nativeCues;
      this.latestTargetCues = targetCues;
      this.latestNativeCues = nativeCues;
    }
  }

  stopOcr(): void {
    this.ocrTargetSlot = null;
    this.ocrNativeSlot = null;
    if (this.preOcrSources) {
      this.activeTargetSource = this.preOcrSources.target;
      this.activeNativeSource = this.preOcrSources.native;
      this.preOcrSources = null;
    }
  }

  selectOcr(role: 'target' | 'native'): void {
    if (role === 'target') this.activeTargetSource = 'ocr';
    else this.activeNativeSource = 'ocr';
  }

  selectTranslated(role: 'target' | 'native'): void {
    if (role === 'native') this.activeNativeSource = 'translated';
  }

  // === Panel building ===

  basePanelItems(role: 'target' | 'native'): { items: SubtitlePanelItem[]; activeIndex: number } {
    const autoItems = role === 'target' ? this.autoTargetItems : this.autoNativeItems;
    const importedItems = role === 'target' ? this.importedTargetItems : this.importedNativeItems;
    const searchedItems = role === 'target' ? this.searchedTargetItems : this.searchedNativeItems;
    const autoActive = role === 'target' ? this.activeTargetIndex : this.activeNativeIndex;
    const importActive = role === 'target' ? this.activeImportTargetIndex : this.activeImportNativeIndex;
    const searchedActive = role === 'target' ? this.activeSearchedTargetIndex : this.activeSearchedNativeIndex;
    const source = role === 'target' ? this.activeTargetSource : this.activeNativeSource;
    const baseItems = [...autoItems, ...importedItems, ...searchedItems];

    // No subtitles → default to Off (index -1)
    if (baseItems.length === 0 && !(role === 'native' && this.translatedNativeSlot)) {
      return { items: [], activeIndex: -1 };
    }

    // Generate-native: always include the translated virtual entry in the panel
    // so the user can switch back to it; highlight it when activeNativeSource
    // is 'translated'.
    if (role === 'native' && this.translatedNativeSlot) {
      const idx = Math.min(Math.max(0, this.translatedNativeSlot.replacedIndex), baseItems.length);
      const items = [...baseItems.slice(0, idx), this.translatedNativeSlot.item, ...baseItems.slice(idx + 1)];
      if (source === 'translated') {
        return { items, activeIndex: idx };
      }
      if (source === 'searched' && searchedItems.length > 0) {
        const baseIdx = autoItems.length + importedItems.length + searchedActive;
        return { items, activeIndex: baseIdx >= idx ? baseIdx + 1 : baseIdx };
      }
      if (source === 'imported' && importedItems.length > 0) {
        const baseIdx = autoItems.length + importActive;
        return { items, activeIndex: baseIdx >= idx ? baseIdx + 1 : baseIdx };
      }
      const baseIdx = autoActive;
      return { items, activeIndex: baseIdx >= idx ? baseIdx + 1 : baseIdx };
    }

    if (source === 'searched' && searchedItems.length > 0) {
      return { items: baseItems, activeIndex: autoItems.length + importedItems.length + searchedActive };
    }
    if (source === 'imported' && importedItems.length > 0) {
      return { items: baseItems, activeIndex: autoItems.length + importActive };
    }
    return { items: baseItems, activeIndex: autoActive };
  }

  mergedPanelItems(role: 'target' | 'native'): { items: SubtitlePanelItem[]; activeIndex: number } {
    const base = this.basePanelItems(role);
    const ocrSlot = role === 'target' ? this.ocrTargetSlot : this.ocrNativeSlot;
    if (!ocrSlot) return base;
    const source = role === 'target' ? this.activeTargetSource : this.activeNativeSource;
    const items = [...base.items, ocrSlot.item];
    return { items, activeIndex: source === 'ocr' ? items.length - 1 : base.activeIndex };
  }

  getPanelState(role: 'target' | 'native'): { items: SubtitlePanelItem[]; activeIndex: number } {
    return this.mergedPanelItems(role);
  }

  // === Selection getters ===

  getActiveSource(role: 'target' | 'native'): 'auto' | 'imported' | 'searched' | 'translated' | 'ocr' | 'off' {
    const index = role === 'target' ? this.activeTargetIndex : this.activeNativeIndex;
    if (index === -1) return 'off';
    return role === 'target' ? this.activeTargetSource : this.activeNativeSource;
  }

  getCuesForRole(role: 'target' | 'native'): SrtCue[] {
    const source = role === 'target' ? this.activeTargetSource : this.activeNativeSource;
    const index = role === 'target' ? this.activeTargetIndex : this.activeNativeIndex;

    if (index === -1) return [];

    if (source === 'auto') {
      return role === 'target' ? this.latestTargetCues : this.latestNativeCues;
    }
    if (source === 'imported') {
      const importIndex = role === 'target' ? this.activeImportTargetIndex : this.activeImportNativeIndex;
      return this.getImportCues(role, importIndex) ?? [];
    }
    if (source === 'searched') {
      const searchIndex = role === 'target' ? this.activeSearchedTargetIndex : this.activeSearchedNativeIndex;
      return this.getSearchedCues(role, searchIndex) ?? [];
    }
    if (role === 'native' && source === 'translated') {
      return this.translatedNativeSlot?.cues ?? [];
    }
    if (source === 'ocr') {
      const slot = role === 'target' ? this.ocrTargetSlot : this.ocrNativeSlot;
      return slot?.cues ?? [];
    }
    return [];
  }

  selectOff(role: 'target' | 'native'): void {
    if (role === 'target') {
      this.activeTargetSource = 'auto';
      this.activeTargetIndex = -1;
      this.latestTargetCues = [];
      this.clearTranslatedNativeState();
    } else {
      this.activeNativeSource = 'auto';
      this.activeNativeIndex = -1;
    }
  }

  // === Reset ===

  clearTranslatedNativeState(): void {
    this.translatedNativeSlot = null;
  }

  reset(): void {
    this.latestTargetCues = [];
    this.latestNativeCues = [];
    this.targetMatches = [];
    this.nativeMatches = [];
    this.activeTargetIndex = 0;
    this.activeNativeIndex = 0;
    this.autoTargetItems = [];
    this.autoNativeItems = [];
    this.importedTargetItems = [];
    this.importedNativeItems = [];
    this.activeImportTargetIndex = 0;
    this.activeImportNativeIndex = 0;
    this.importedParsedTarget = [];
    this.importedParsedNative = [];
    this.searchedTargetItems = [];
    this.searchedNativeItems = [];
    this.activeSearchedTargetIndex = 0;
    this.activeSearchedNativeIndex = 0;
    this.parsedSearchCache.clear();
    this.activeTargetSource = 'auto';
    this.activeNativeSource = 'auto';
    this.clearTranslatedNativeState();
    this.ocrTargetSlot = null;
    this.ocrNativeSlot = null;
    this.preOcrSources = null;
  }
}
