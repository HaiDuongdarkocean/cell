import type { NavClusterSettings, SubtitleBlockSettings, Settings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import {
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
} from '@/shared/config/config';
import { saveSettings } from '@/shared/lib/storage/settingsStore';
import type { MountSubtitleResult } from './mountSubtitle';
import type { AppearanceState, OffsetState } from './subtitlePanelsTypes';
import type { SubtitleCueEngine } from './subtitleCueEngine';

const OFFSET_PERSIST_DEBOUNCE_MS = 300;

export interface SubtitleStyleControllerOptions {
  engine: SubtitleCueEngine;
  mount: MountSubtitleResult;
  getOffsetMs: () => number;
  onOffsetChange: (ms: number) => void;
  onManagerUpdate: () => void;
}

/** Owns subtitle style, preview text and hide-state for the React subtitle
 *  controller. Keeps the overlay styles, manager appearance view and offset
 *  panel in sync with the cue engine while debouncing persistence. */
export class SubtitleStyleController {
  private readonly engine: SubtitleCueEngine;
  private readonly mount: MountSubtitleResult;
  private readonly getOffsetMs: () => number;
  private readonly onOffsetChange: (ms: number) => void;
  private readonly onManagerUpdate: () => void;

  private targetHidden = false;
  private nativeHidden = false;
  private previewTargetText = 'This is how the target subtitle will look.';
  private previewNativeText = 'This is how the native subtitle will look.';

  private stylePersistTimer: ReturnType<typeof setTimeout> | null = null;
  private blockPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private clusterPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private previewTextPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private yOffsetPersistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: SubtitleStyleControllerOptions) {
    this.engine = options.engine;
    this.mount = options.mount;
    this.getOffsetMs = options.getOffsetMs;
    this.onOffsetChange = options.onOffsetChange;
    this.onManagerUpdate = options.onManagerUpdate;
  }

  getTargetHidden(): boolean {
    return this.targetHidden;
  }

  getNativeHidden(): boolean {
    return this.nativeHidden;
  }

  setHidden(targetHidden: boolean, nativeHidden: boolean): void {
    this.targetHidden = targetHidden;
    this.nativeHidden = nativeHidden;
  }

  setPreviewText(role: 'target' | 'native', text: string): void {
    if (role === 'target') this.previewTargetText = text;
    else this.previewNativeText = text;
  }

  buildOffsetState(): OffsetState {
    return {
      targetMs: this.getOffsetMs(),
      nativeMs: this.getOffsetMs(),
      onTargetChange: (ms) => this.onOffsetChange(ms),
      onNativeChange: (ms) => this.onOffsetChange(ms),
    };
  }

  buildAppearanceState(): AppearanceState {
    return {
      targetStyle: this.engine.getTargetStyle(),
      nativeStyle: this.engine.getNativeStyle(),
      blockSettings: this.engine.getBlockSettings(),
      clusterSettings: this.engine.getClusterSettings(),
      defaultTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
      defaultNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
      previewTargetText: this.previewTargetText,
      previewNativeText: this.previewNativeText,
      onStyleChange: (role, partial) => this.handleStyleChange(role, partial),
      onBlockSettingsChange: (partial) => this.handleBlockSettingsChange(partial),
      onClusterSettingsChange: (partial) => this.handleClusterSettingsChange(partial),
      onResetStyle: (role) => this.handleResetStyle(role),
      onPreviewTextChange: (role, text) => this.handlePreviewTextChange(role, text),
    };
  }

  updateStylesFromEngine(): void {
    this.mount.setStyles(this.engine.getTargetStyle(), this.engine.getNativeStyle());
    this.mount.setClusterSettings(this.engine.getClusterSettings());
    this.mount.setBlockSettings(this.engine.getBlockSettings());
  }

  /** ADR-025: drag reposition -> update engine block settings + persist yOffsetPercent. */
  handleDragReposition(yOffsetPercent: number): void {
    this.engine.updateBlockSettings({ yOffsetPercent });
    this.mount.setYOffsetPercent(yOffsetPercent);
    if (this.yOffsetPersistTimer) clearTimeout(this.yOffsetPersistTimer);
    this.yOffsetPersistTimer = setTimeout(() => {
      this.yOffsetPersistTimer = null;
      const current = this.engine.getBlockSettings();
      saveSettings({ subtitleBlockSettings: { ...current, yOffsetPercent } } as Partial<Settings>).catch(() => undefined);
    }, OFFSET_PERSIST_DEBOUNCE_MS);
  }

  /** Toggle hide/show for a section's subtitle in the overlay. */
  handleHideSection(role: 'target' | 'native'): void {
    if (role === 'target') {
      this.targetHidden = !this.targetHidden;
      const style = this.engine.getTargetStyle();
      this.engine.updateSettings({ targetStyle: { ...style, visible: !this.targetHidden } });
    } else {
      this.nativeHidden = !this.nativeHidden;
      const style = this.engine.getNativeStyle();
      this.engine.updateSettings({ nativeStyle: { ...style, visible: !this.nativeHidden } });
    }
    this.updateStylesFromEngine();
    this.onManagerUpdate();
  }

  /** Toggle hide/show for both target + native subtitles in the overlay. */
  handleHideBoth(): void {
    const bothHidden = this.targetHidden && this.nativeHidden;
    if (bothHidden) {
      this.targetHidden = false;
      this.nativeHidden = false;
    } else {
      this.targetHidden = true;
      this.nativeHidden = true;
    }
    const targetStyle = this.engine.getTargetStyle();
    const nativeStyle = this.engine.getNativeStyle();
    this.engine.updateSettings({
      targetStyle: { ...targetStyle, visible: !this.targetHidden },
      nativeStyle: { ...nativeStyle, visible: !this.nativeHidden },
    });
    this.updateStylesFromEngine();
    this.onManagerUpdate();
  }

  /** Merge partial style with current engine style, apply to engine, debounced persist. */
  private handleStyleChange(role: 'target' | 'native', partial: Partial<OverlayStyleConfig>): void {
    const current = role === 'target' ? this.engine.getTargetStyle() : this.engine.getNativeStyle();
    const merged = { ...current, ...partial };
    if (role === 'target') this.engine.updateSettings({ targetStyle: merged });
    else this.engine.updateSettings({ nativeStyle: merged });
    this.updateStylesFromEngine();
    this.onManagerUpdate();

    if (this.stylePersistTimer) clearTimeout(this.stylePersistTimer);
    this.stylePersistTimer = setTimeout(() => {
      const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
      saveSettings({ [key]: merged } as Partial<Settings>).catch(() => undefined);
      this.stylePersistTimer = null;
    }, OFFSET_PERSIST_DEBOUNCE_MS);
  }

  private handleBlockSettingsChange(partial: Partial<SubtitleBlockSettings>): void {
    const current = this.engine.getBlockSettings();
    const merged = { ...current, ...partial };
    this.engine.updateSettings({ blockSettings: merged });
    if (partial.yOffsetPercent !== undefined) {
      this.mount.setYOffsetPercent(partial.yOffsetPercent);
    }
    this.updateStylesFromEngine();
    this.onManagerUpdate();

    if (this.blockPersistTimer) clearTimeout(this.blockPersistTimer);
    this.blockPersistTimer = setTimeout(() => {
      saveSettings({ subtitleBlockSettings: merged } as Partial<Settings>).catch(() => undefined);
      this.blockPersistTimer = null;
    }, OFFSET_PERSIST_DEBOUNCE_MS);
  }

  private handleClusterSettingsChange(partial: Partial<NavClusterSettings>): void {
    const current = this.engine.getClusterSettings();
    const merged = { ...current, ...partial };
    this.engine.updateSettings({ clusterSettings: merged });
    this.updateStylesFromEngine();
    this.onManagerUpdate();

    if (this.clusterPersistTimer) clearTimeout(this.clusterPersistTimer);
    this.clusterPersistTimer = setTimeout(() => {
      saveSettings({ navClusterSettings: merged } as Partial<Settings>).catch(() => undefined);
      this.clusterPersistTimer = null;
    }, OFFSET_PERSIST_DEBOUNCE_MS);
  }

  private handleResetStyle(role: 'target' | 'native'): void {
    const defaults = role === 'target' ? DEFAULT_OVERLAY_STYLE_TARGET : DEFAULT_OVERLAY_STYLE_NATIVE;
    if (role === 'target') this.engine.updateSettings({ targetStyle: defaults });
    else this.engine.updateSettings({ nativeStyle: defaults });
    this.updateStylesFromEngine();
    this.onManagerUpdate();

    const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
    saveSettings({ [key]: defaults } as Partial<Settings>).catch(() => undefined);
  }

  private handlePreviewTextChange(role: 'target' | 'native', text: string): void {
    if (role === 'target') this.previewTargetText = text;
    else this.previewNativeText = text;
    this.onManagerUpdate();

    if (this.previewTextPersistTimer) clearTimeout(this.previewTextPersistTimer);
    this.previewTextPersistTimer = setTimeout(() => {
      const key = role === 'target' ? 'subtitlePreviewTargetText' : 'subtitlePreviewNativeText';
      saveSettings({ [key]: text } as Partial<Settings>).catch(() => undefined);
      this.previewTextPersistTimer = null;
    }, OFFSET_PERSIST_DEBOUNCE_MS);
  }

  destroy(): void {
    if (this.stylePersistTimer) { clearTimeout(this.stylePersistTimer); this.stylePersistTimer = null; }
    if (this.blockPersistTimer) { clearTimeout(this.blockPersistTimer); this.blockPersistTimer = null; }
    if (this.clusterPersistTimer) { clearTimeout(this.clusterPersistTimer); this.clusterPersistTimer = null; }
    if (this.previewTextPersistTimer) { clearTimeout(this.previewTextPersistTimer); this.previewTextPersistTimer = null; }
    if (this.yOffsetPersistTimer) { clearTimeout(this.yOffsetPersistTimer); this.yOffsetPersistTimer = null; }
  }
}
