import type { ReactSubtitleController } from './reactSubtitleController';
import type { SubtitleSyncController } from './subtitleSyncController';
import type { BackgroundPrefillController } from '@/features/translate/logic/translatePrefill';
import type { DictionaryBridge } from '../logic/dictionaryBridge';
import type { ToastOptions } from './subtitleUI';
import type { CardCreatorAction } from './subtitleCueEngine';
import type { BilingualCue, KeyboardShortcut } from '@/entities/media';

export interface ContentScriptContext {
  readonly video: HTMLVideoElement;
  readonly container: HTMLElement;
  readonly blockController: ReactSubtitleController;
  readonly syncController: SubtitleSyncController;
   readonly sharedWebTextCtrl: DictionaryBridge | undefined;
  readonly debouncedToast: (message: string, container: HTMLElement, options?: ToastOptions) => void;

  getOffsetController(): ReactSubtitleController | null;
  getShortcuts(): KeyboardShortcut[];
  isSidePanelOpen(): boolean;
  setSidePanelOpen(open: boolean): void;
  getEffectiveMs(): number;
  getBilingualCues(): BilingualCue[];
  setBilingualCues(cues: BilingualCue[]): void;
  getTranslatePrefill(): BackgroundPrefillController | null;
  setTranslatePrefill(prefill: BackgroundPrefillController | null): void;
  getLastAutoLoadUrl(): string | undefined;
  setLastAutoLoadUrl(url: string | undefined): void;
  getLastAutoLoadKey(): string | undefined;
  setLastAutoLoadKey(key: string | undefined): void;

  showOverlay(): void;
  toggleOverlay(): void;
  togglePlay(): void;
  refreshPanel(role: 'target' | 'native'): void;
  syncSidePanelFromBlock(): void;
  clearTranslatedNativeState(): void;
  updateGenerateNativeEnabled(): void;
  handleCardCreatorAction(action: CardCreatorAction): Promise<void>;
  handleGenerateNative(): Promise<void>;
  handleSubtitleStatusKey(key: string): boolean;
  handleWebStatusKey?(key: string): boolean;
  syncSubtitleTokenize(): Promise<void>;
}
