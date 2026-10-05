import { useCuesStore } from '../cuesStore';
import {
  parseAndDetectFiles,
  assignImportRole,
  formatSubtitleName,
  mergeCuesForPanel,
  broadcastCues,
  createDragHint,
  type ParsedFile,
} from '@/features/subtitle';
import { canonicalNavUrl, loadTargetNativeLangs } from './contentScriptShared';
import { cleanTargetCues } from '../logic/subtitleCleanupRuntime';
import { t } from '@/shared/i18n';
import type { ContentScriptContext } from './contentScriptContext';

export function createProcessImportedFiles(ctx: ContentScriptContext): (files: File[], _container: HTMLElement) => Promise<void> {
  const { blockController, syncController } = ctx;

  /**
   * ADR-015 T10: Process imported files (multi-file) → panel + cues + toast.
   * Flow: parseAndDetectFiles → assignImportRole → panel.updateTarget/Native
   * → loadBilingualCues (first target + first native) → toast.
   */
  return async function processImportedFiles(files: File[], _container: HTMLElement): Promise<void> {
    if (files.length === 0) return;
    const receiptNavUrl = canonicalNavUrl(location.href);
    const { targetLang, nativeLang } = await loadTargetNativeLangs();
    const parsed = await parseAndDetectFiles(files);
    if (canonicalNavUrl(location.href) !== receiptNavUrl) return;
    if (parsed.length === 0) {
      ctx.debouncedToast(t('subtitle.import.noValid'), _container, { variant: 'error' });
      return;
    }
    const assignment = assignImportRole(parsed, targetLang, nativeLang);

    // Dedup guard: skip files that match an existing imported item by
    // name + format + size. Prevents duplicate imports and gives the user
    // a clear toast listing which files were skipped.
    const isDuplicate = (file: File, format: string, existing: ParsedFile[]): boolean =>
      existing.some(p => p.file.name === file.name && p.format === format && p.file.size === file.size);

    const dupTarget = assignment.target.filter(f => isDuplicate(f.file, f.format, syncController.importedParsedTarget));
    const dupNative = assignment.native.filter(f => isDuplicate(f.file, f.format, syncController.importedParsedNative));
    const newTarget = assignment.target.filter(f => !isDuplicate(f.file, f.format, syncController.importedParsedTarget));
    const newNative = assignment.native.filter(f => !isDuplicate(f.file, f.format, syncController.importedParsedNative));
    const totalDups = dupTarget.length + dupNative.length;

    if (newTarget.length === 0 && newNative.length === 0) {
      const names = [...dupTarget, ...dupNative].map(f => f.file.name);
      const label = names.length === 1 ? names[0] : t('subtitle.import.fileCount', [names.length]);
      ctx.debouncedToast(t('subtitle.import.duplicate', [label]), _container, { variant: 'warning' });
      return;
    }

    // Build panel items — APPEND to existing imported items (not overwrite).
    const existingTargetCount = syncController.importedParsedTarget.length;
    const existingNativeCount = syncController.importedParsedNative.length;
    const newTargetItems = newTarget.map((f, i) => ({
      id: `imported-target-${existingTargetCount + i}`,
      name: formatSubtitleName('imported', '', existingTargetCount + i, f.file.name),
      format: f.format,
      size: f.file.size,
      source: 'imported' as const,
      role: 'target' as const,
      index: existingTargetCount + i,
    }));
    const newNativeItems = newNative.map((f, i) => ({
      id: `imported-native-${existingNativeCount + i}`,
      name: formatSubtitleName('imported', '', existingNativeCount + i, f.file.name),
      format: f.format,
      size: f.file.size,
      source: 'imported' as const,
      role: 'native' as const,
      index: existingNativeCount + i,
    }));
    syncController.importedTargetItems = [...syncController.importedTargetItems, ...newTargetItems];
    syncController.importedNativeItems = [...syncController.importedNativeItems, ...newNativeItems];
    syncController.importedParsedTarget = [...syncController.importedParsedTarget, ...newTarget];
    syncController.importedParsedNative = [...syncController.importedParsedNative, ...newNative];
    syncController.activeImportTargetIndex = existingTargetCount;
    syncController.activeImportNativeIndex = existingNativeCount;
    // ADR-015 T10 fix: merge auto + imported items in panel (both visible).
    // Mark active source as imported for roles that got new (non-duplicate) files.
    if (newTarget.length > 0) { syncController.activeTargetSource = 'imported'; useCuesStore.getState().setLoadStatus('target', { state: 'loaded', source: 'imported' }); }
    if (newNative.length > 0) { syncController.activeNativeSource = 'imported'; useCuesStore.getState().setLoadStatus('native', { state: 'loaded', source: 'imported' }); }
    // Import resets the translated native slot (new target/native sources).
    ctx.clearTranslatedNativeState();
    ctx.refreshPanel('target');
    ctx.refreshPanel('native');

    // Load cues: first new target + first new native (D1 merge keeps other side)
    const targetCues = cleanTargetCues(newTarget[0]?.cues ?? []);
    const nativeCues = newNative[0]?.cues ?? [];
    if (targetCues.length > 0 || nativeCues.length > 0) {
      blockController?.loadBilingualCues(targetCues, nativeCues);
      ctx.showOverlay();
      syncController.latestTargetCues = targetCues;
      ctx.getOffsetController()?.loadCues(true);
      ctx.setBilingualCues(mergeCuesForPanel(targetCues, nativeCues));
      broadcastCues(ctx.getBilingualCues());
    } else if (newTarget.length === 0 && newNative.length === 0) {
      const fallbackCues = cleanTargetCues(parsed[0].cues);
      blockController?.loadCues(fallbackCues); // fallback: single mode
      ctx.showOverlay();
      syncController.latestTargetCues = fallbackCues;
      ctx.getOffsetController()?.loadCues(true);
    }
    ctx.updateGenerateNativeEnabled();

    // Toast — include duplicate count if any were skipped
    const total = newTarget.length + newNative.length;
    const ignoredCount = assignment.ignored.length;
    const dupTxt = totalDups > 0 ? t('subtitle.import.dupSkipped', [totalDups]) : '';
    if (total === 1) {
      const importedName = newTarget[0]?.file.name ?? newNative[0]?.file.name ?? '';
      ctx.debouncedToast(t('subtitle.import.importedOne', [importedName, dupTxt]), _container, { variant: 'success' });
    } else {
      const parts: string[] = [];
      if (newTarget.length > 0) parts.push(t('subtitle.import.partTarget', [newTarget.length]));
      if (newNative.length > 0) parts.push(t('subtitle.import.partNative', [newNative.length]));
      const ignoredTxt = ignoredCount > 0 ? t('subtitle.import.ignoredSuffix', [ignoredCount]) : '';
      ctx.debouncedToast(t('subtitle.import.importedMany', [total, parts.join(', '), ignoredTxt + dupTxt]), _container, { variant: 'success' });
    }
  };
}

/** Wire drag-drop on container → parse → loadCues + drag hover hint. */
export function wireContainerDragImport(container: HTMLElement, onDrop: (files: File[]) => void): void {
  const dragHint = createDragHint(container);
  let dragCounter = 0;

  container.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dragHint.classList.add('subtitle-drag-hint--visible');
  });
  container.addEventListener('dragover', (e) => e.preventDefault());
  container.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dragHint.classList.remove('subtitle-drag-hint--visible');
    }
  });
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragHint.classList.remove('subtitle-drag-hint--visible');
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    onDrop(files);
  });
}
