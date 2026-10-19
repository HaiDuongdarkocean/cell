import { sendMessage } from '@/shared/lib/chrome-apis';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { useCuesStore } from '../cuesStore';
import { isoCodeToLabel } from '@/features/detection';
import {
  fetchAndParseSubtitle,
  resolveFormat,
  formatSubtitleName,
  parseSubtitle,
  showToast,
} from '@/features/subtitle';
import type { SubtitlePanelItem } from '@/features/subtitle';
import { cleanTargetCues } from '../logic/subtitleCleanupRuntime';
import { canonicalNavUrl } from './contentScriptShared';
import { t } from '@/shared/i18n';
import type { ContentScriptContext } from './contentScriptContext';
import type { SrtCue } from '@/entities/media';
import type { ResolveSubtitleDownloadResult } from '@/entities/message';
import type { SubtitleSearchResult } from '@/entities/subtitle/searchTypes';

export function createSubtitleSelectionHandlers(ctx: ContentScriptContext): {
  onManagerSelect: (role: 'target' | 'native', index: number) => Promise<void>;
  handleSearchResultSelect: (result: SubtitleSearchResult, role: 'target' | 'native') => Promise<void>;
} {
  const { container, blockController, syncController } = ctx;

  /**
   * ADR-015 T11: User selected an imported subtitle via the manager panel.
   * Loads cues from the stored parsed file + toast.
   */
  async function onPanelSelect(role: 'target' | 'native', index: number): Promise<void> {
    const items = role === 'target' ? syncController.importedTargetItems : syncController.importedNativeItems;
    if (index >= items.length) return;
    if (role === 'target') { syncController.activeImportTargetIndex = index; syncController.activeTargetSource = 'imported'; }
    else { syncController.activeImportNativeIndex = index; syncController.activeNativeSource = 'imported'; }

    // Refresh manager panel active state immediately so the UI reflects the click.
    ctx.refreshPanel(role);

    // Retrieve cues from the parsed file (stored in a side map)
    const parsed = role === 'target'
      ? syncController.importedParsedTarget[index]
      : syncController.importedParsedNative[index];
    if (!parsed) return;

    if (role === 'target') {
      const cues = cleanTargetCues(parsed.cues);
      blockController?.loadBilingualCues(cues, null);
      syncController.latestTargetCues = cues;
      ctx.clearTranslatedNativeState();
      syncController.activeNativeSource = 'auto';
      syncController.activeNativeIndex = 0;
      ctx.refreshPanel('native');
      ctx.updateGenerateNativeEnabled();
    } else {
      blockController?.loadBilingualCues(null, parsed.cues);
    }
    ctx.showOverlay();
    ctx.syncSidePanelFromBlock();
    useCuesStore.getState().setLoadStatus(role, { state: 'loaded', source: 'imported' });
    ctx.debouncedToast(t('subtitle.select.switched', [parsed.file.name]), container, { variant: 'success' });
  }

  /**
   * ADR-014 D4: user selected a different subtitle via dropdown.
   * Re-fetch (cache hit instant) + loadBilingualCues (D1 merge keeps other side)
   * + save preference to chrome.storage.local (origin → lang → index).
   */
  async function onSubtitleSelect(role: 'target' | 'native', index: number): Promise<void> {
    const matches = role === 'target' ? syncController.targetMatches : syncController.nativeMatches;
    if (index >= matches.length) return;
    const sub = matches[index];
    if (role === 'target') { syncController.activeTargetIndex = index; syncController.activeTargetSource = 'auto'; }
    else { syncController.activeNativeIndex = index; syncController.activeNativeSource = 'auto'; }

    // Refresh manager panel active state immediately so the UI reflects the click
    // before the async fetch. The fetch can fail (CORS/offline), but the selected
    // index should still be visible as the user's choice.
    ctx.refreshPanel(role);
    const receiptNavUrl = canonicalNavUrl(location.href);

    try {
      const result = await fetchAndParseSubtitle(sub.url, resolveFormat(sub.format, sub.url), window.location.href, sub.initiator);
      if (canonicalNavUrl(location.href) !== receiptNavUrl) return;
      if (!result.success || result.cues.length === 0) {
        console.error('[onSubtitleSelect] failed', result.error);
        showToast(t('subtitle.select.loadTrackFailed', [index + 1]), container, { variant: 'error' });
        return;
      }
      // D1 merge: loadBilingualCues keeps other side when this side is empty.
      // We only update the selected side by passing its cues + empty other side.
      if (role === 'target') {
        const cues = cleanTargetCues(result.cues);
        blockController?.loadBilingualCues(cues, null);
        // ADR-018: update nav cluster — keep native side, replace target
        syncController.latestTargetCues = cues;
        ctx.clearTranslatedNativeState();
        syncController.activeNativeSource = 'auto';
        syncController.activeNativeIndex = 0;
        ctx.refreshPanel('native');
        ctx.updateGenerateNativeEnabled();
        // updateCues(syncController.latestTargetCues, latestNativeCues);
      } else {
        blockController?.loadBilingualCues(null, result.cues);
        // ADR-018: update nav cluster — keep target side, replace native
        // updateCues(syncController.latestTargetCues, latestNativeCues);
      }
      ctx.showOverlay();
      ctx.syncSidePanelFromBlock();
      useCuesStore.getState().setLoadStatus(role, { state: 'loaded', languageLabel: formatSubtitleName('auto', sub.language, index, undefined, sub.displayName), source: 'auto' });
      showToast(t('subtitle.select.switchedTrack', [index + 1]), container, { variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[onSubtitleSelect] error', msg);
      showToast(t('subtitle.select.switchFailed'), container, { variant: 'error' });
    }

    // Save preference: origin → lang → index
    try {
      const origin = new URL(window.location.href).hostname;
      const lang = sub.language;
      const settings = await loadSettings();
      const pref = { ...(settings.subtitlePreference ?? {}) };
      const sitePref = { ...(pref[origin] ?? {}) };
      sitePref[lang] = index;
      pref[origin] = sitePref;
      await saveSettings({ ...settings, subtitlePreference: pref });
    } catch {
      // ponytail: storage might not be available in test contexts — ignore
    }
  }

  /**
   * User selected an already-loaded searched subtitle via the manager panel.
   * Loads cues from syncController.parsedSearchCache by the searched item index.
   */
  async function onSearchedSelect(role: 'target' | 'native', index: number): Promise<void> {
    const items = role === 'target' ? syncController.searchedTargetItems : syncController.searchedNativeItems;
    if (index >= items.length) return;
    const item = items[index];
    if (role === 'target') { syncController.activeSearchedTargetIndex = index; syncController.activeTargetSource = 'searched'; }
    else { syncController.activeSearchedNativeIndex = index; syncController.activeNativeSource = 'searched'; }
    ctx.refreshPanel(role);

    // Retrieve cues from cache by result.id (encoded in item.id).
    const resultId = item.id.replace(`searched-${role}-`, '');
    const cachedCues = syncController.parsedSearchCache.get(resultId);
    if (!cachedCues) return;
    const cues = role === 'target' ? cleanTargetCues(cachedCues) : cachedCues;

    if (role === 'target') {
      blockController?.loadBilingualCues(cues, null);
      syncController.latestTargetCues = cues;
      ctx.clearTranslatedNativeState();
      syncController.activeNativeSource = 'auto';
      syncController.activeNativeIndex = 0;
      ctx.refreshPanel('native');
      ctx.updateGenerateNativeEnabled();
    } else {
      blockController?.loadBilingualCues(null, cues);
    }
    ctx.showOverlay();
    ctx.syncSidePanelFromBlock();
    useCuesStore.getState().setLoadStatus(role, { state: 'loaded', source: 'search' });
    ctx.debouncedToast(t('subtitle.select.switched', [item.name]), container, { variant: 'success' });
  }

  /**
   * ADR-015: unified manager panel selection handler. The panel shows a merged
   * list (auto items first, then imported items). Route based on which item the
   * user clicked: auto items → onSubtitleSelect (re-fetch by auto index),
   * imported items → onPanelSelect (load parsed cues by imported index).
   */
  async function onManagerSelect(role: 'target' | 'native', index: number): Promise<void> {
    // Off option (index -1): clear cues for this role, mark as Off
    if (index === -1) {
      if (role === 'target') {
        syncController.activeTargetSource = 'auto';
        syncController.activeTargetIndex = -1;
        syncController.latestTargetCues = [];
        ctx.clearTranslatedNativeState();
      } else {
        syncController.activeNativeSource = 'auto';
        syncController.activeNativeIndex = -1;
      }
      blockController?.loadBilingualCues(
        role === 'target' ? [] : (blockController.getTargetCues() as SrtCue[]),
        role === 'native' ? [] : (blockController.getNativeCues() as SrtCue[]),
      );
      ctx.refreshPanel(role);
      if (role === 'target') { ctx.refreshPanel('native'); ctx.updateGenerateNativeEnabled(); }
      ctx.syncSidePanelFromBlock();
      return;
    }
    const { items } = syncController.mergedPanelItems(role);
    const item = items[index];
    if (!item) return;
    if (item.source === 'imported') {
      await onPanelSelect(role, item.index);
      return;
    }
    if (item.source === 'searched') {
      await onSearchedSelect(role, item.index);
      return;
    }
    if (item.source === 'ocr') {
      // OCR dual-stream: re-activate the live OCR track for this role.
      const slot = role === 'target' ? syncController.ocrTargetSlot : syncController.ocrNativeSlot;
      if (slot) {
        if (role === 'target') syncController.activeTargetSource = 'ocr';
        else syncController.activeNativeSource = 'ocr';
        ctx.refreshPanel(role);
        // D1 merge: empty other side keeps the existing side (onSubtitleSelect pattern).
        blockController?.loadBilingualCues(role === 'target' ? slot.cues : null, role === 'native' ? slot.cues : null);
        ctx.showOverlay();
        ctx.syncSidePanelFromBlock();
      }
      return;
    }
    if (item.source === 'translated') {
      if (role === 'native' && syncController.translatedNativeSlot) {
        syncController.activeNativeSource = 'translated';
        ctx.refreshPanel('native');
        blockController?.loadBilingualCues([...blockController.getTargetCues()], syncController.translatedNativeSlot.cues);
        ctx.showOverlay();
        ctx.syncSidePanelFromBlock();
      }
      return;
    }
    await onSubtitleSelect(role, item.index);
  }

  /**
   * Subtitle search: user selected a search result from SubtitleSearchPanel.
   * Sends RESOLVE_SUBTITLE_DOWNLOAD to background → parses content → caches
   * cues by result.id → creates a 'searched' panel item → loads bilingual cues.
   * Re-selecting the same result uses the syncController.parsedSearchCache (no re-fetch).
   */
  async function handleSearchResultSelect(result: SubtitleSearchResult, role: 'target' | 'native'): Promise<void> {
    // Cache hit: reuse parsed cues (user re-selected a previously loaded result).
    const cachedCues = syncController.parsedSearchCache.get(result.id);
    let cues: SrtCue[];
    if (cachedCues) {
      cues = cachedCues;
    } else {
      // Ask background to resolve the download (fetch + decode archive).
      const receiptNavUrl = canonicalNavUrl(location.href);
      const response = await sendMessage<{ success?: boolean; data?: ResolveSubtitleDownloadResult; error?: string }>({
        type: MESSAGE_TYPES.RESOLVE_SUBTITLE_DOWNLOAD,
        payload: { result, role },
      });
      if (canonicalNavUrl(location.href) !== receiptNavUrl) return;
      if (!response?.success || !response.data?.content) {
        const msg = response?.error ?? response?.data?.error?.type ?? t('subtitle.select.downloadFailed');
        showToast(t('subtitle.select.loadFailed', [msg]), container, { variant: 'error' });
        return;
      }
      const parsed = parseSubtitle(response.data.content, response.data.format ?? result.format);
      if (!parsed.success || parsed.cues.length === 0) {
        showToast(t('subtitle.select.parseFailed', [parsed.error ?? t('subtitle.select.noCues')]), container, { variant: 'error' });
        return;
      }
      cues = parsed.cues;
      syncController.parsedSearchCache.set(result.id, cues);
    }

    // Build panel item + append to the searched items array for this role.
    const items = role === 'target' ? syncController.searchedTargetItems : syncController.searchedNativeItems;
    const existingIdx = items.findIndex((it) => it.id === `searched-${role}-${result.id}`);
    if (existingIdx >= 0) {
      // Already in the panel — just select it.
      await onSearchedSelect(role, existingIdx);
      return;
    }
    const item: SubtitlePanelItem = {
      id: `searched-${role}-${result.id}`,
      name: result.name,
      format: result.format,
      source: 'searched',
      role,
      index: items.length,
    };
    if (role === 'target') {
      syncController.searchedTargetItems = [...syncController.searchedTargetItems, item];
      syncController.activeSearchedTargetIndex = item.index;
      syncController.activeTargetSource = 'searched';
    } else {
      syncController.searchedNativeItems = [...syncController.searchedNativeItems, item];
      syncController.activeSearchedNativeIndex = item.index;
      syncController.activeNativeSource = 'searched';
    }
    // Search selection resets the translated native slot (new native source).
    if (role === 'native') ctx.clearTranslatedNativeState();
    ctx.refreshPanel(role);
    if (role === 'target') { ctx.refreshPanel('native'); ctx.updateGenerateNativeEnabled(); }

    // Load cues (D1 merge keeps the other side).
    if (role === 'target') {
      const cleanedCues = cleanTargetCues(cues);
      blockController?.loadBilingualCues(cleanedCues, null);
      syncController.latestTargetCues = cleanedCues;
    } else {
      blockController?.loadBilingualCues(null, cues);
    }
    ctx.showOverlay();
    ctx.syncSidePanelFromBlock();
    const searchLabel = (() => { const l = isoCodeToLabel(result.isoLanguage); return l ? l.charAt(0).toUpperCase() + l.slice(1) : result.isoLanguage; })();
    useCuesStore.getState().setLoadStatus(role, { state: 'loaded', languageLabel: searchLabel, source: 'search' });
    ctx.debouncedToast(t('subtitle.select.loaded', [result.name]), container, { variant: 'success' });
  }

  return { onManagerSelect, handleSearchResultSelect };
}
