import type { DictionaryPopupSettings } from '@/entities/settings/types';
import type { LookupRequest } from '@/entities/dictionary';
import type { HighlightTarget } from '../ui/wordHighlight';
import { WebTriggerController, type WebTriggerPointer } from '@/features/dictionaryPopup/trigger/webTriggerController';
import { type PointerPreset } from '@/features/dictionaryPopup/badgePointer/pointerPosition';
import { mountOrbitalBadge, type OrbitalBadgeMountController } from '@/features/dictionaryPopup/ui/mountOrbitalBadge';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import type { PanelMountController } from './panelBridge';
import { createListenerRegistry } from './listenerRegistry';

export interface OrbitalBadgeSyncDeps {
  readonly getDpSettings: () => DictionaryPopupSettings;
  readonly setDpSettings: (settings: DictionaryPopupSettings) => void;
  readonly panelController?: PanelMountController;
  readonly onLookup: (
    request: LookupRequest,
    requestId: string,
    anchorRect: DOMRect,
    range: HighlightTarget,
    pointer?: WebTriggerPointer,
  ) => void;
  readonly onCancel: (requestId: string) => void;
  readonly isPopupOpen: () => boolean;
}

export interface OrbitalBadgeSync {
  readonly sync: (settings: DictionaryPopupSettings) => void;
  readonly teardownBadge: () => void;
  readonly dispose: () => void;
}

export function createOrbitalBadgeSync(deps: OrbitalBadgeSyncDeps): OrbitalBadgeSync {
  let orbitalBadge: OrbitalBadgeMountController | null = null;
  let orbitalHoverTrigger: WebTriggerController | null = null;
  let orbitalBadgeSize: number | null = null;
  let orbitalBadgeScale: number | null = null;
  // In a child iframe, the orbital badge only mounts while the child document
  // is in native fullscreen or iframe Player Mode (the top-frame badge covers
  // the viewport otherwise). These listeners re-run sync on those transitions
  // so the badge appears on enter and is torn down on exit — keeping exactly
  // one visible badge across normal + fullscreen modes.
  const listeners = createListenerRegistry();
  let fullscreenListenerInstalled = false;
  let pmObserver: MutationObserver | null = null;

  function persistBadgePointerPreset(preset: PointerPreset): void {
    const dpSettings = deps.getDpSettings();
    deps.setDpSettings({ ...dpSettings, badgePointerTrigger: { ...dpSettings.badgePointerTrigger, position: preset } });
    void sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { dictionaryPopup: deps.getDpSettings() } },
    });
  }

  function teardownBadge(): void {
    orbitalBadge?.destroy();
    orbitalBadge = null;
    orbitalBadgeSize = null;
    orbitalBadgeScale = null;
    orbitalHoverTrigger?.detach();
    orbitalHoverTrigger = null;
  }

  function sync(dp: DictionaryPopupSettings): void {
    if (!dp.enabled) {
      teardownBadge();
      return;
    }
    // Install the fullscreen transition listener once (child frames only) so
    // the badge mounts when entering native fullscreen and tears down on exit.
    // Must be installed before the child-fullscreen gate below, otherwise the
    // early return in normal mode would leave the child unable to react to
    // fullscreen transitions.
    if (isChildFrame() && !fullscreenListenerInstalled) {
      const onFs = (): void => { sync(deps.getDpSettings()); };
      fullscreenListenerInstalled = true;
      listeners.add(document, 'fullscreenchange', onFs);
      listeners.add(document, 'webkitfullscreenchange', onFs);
      // Iframe Player Mode runs via the top-frame bridge: the top document
      // fullscreens the <iframe>, so no fullscreenchange fires in this child
      // document. Player Mode marks itself with data-tihoka-player-mode on
      // <html> — observe that attribute to re-sync on PM enter/exit.
      pmObserver = new MutationObserver(() => { sync(deps.getDpSettings()); });
      pmObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-tihoka-player-mode'],
      });
    }
    // Child iframe: the orbital badge is only useful while this child document
    // is in native fullscreen or iframe Player Mode. In normal mode the
    // top-frame badge covers the viewport, so mounting a second badge here
    // would duplicate it (the original 2-badge bug). Mount on fullscreen or
    // Player Mode enter, tear down on exit.
    const pmHost = isChildFrame()
      ? document.querySelector('#Tihoka-subtitle-root[data-tihoka-player-mode]')
      : null;
    if (isChildFrame() && !document.fullscreenElement && !pmHost) {
      teardownBadge();
      return;
    }
    const trigger = dp.badgePointerTrigger;
    // Orbital badge is always mounted when the dictionary popup is enabled
    // (no longer conditional on triggerMode === 'orbital'). The hover trigger
    // handles pointer-tip lookups regardless of the page-level trigger mode.
    if (!orbitalHoverTrigger) {
      orbitalHoverTrigger = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: deps.onLookup,
        onCancel: deps.onCancel,
        isPopupOpen: deps.isPopupOpen,
      });
    }
    const sameDimensions = orbitalBadgeSize === trigger.size && orbitalBadgeScale === trigger.pointerScale;
    if (orbitalBadge) {
      if (!sameDimensions) {
        orbitalBadge.update({ badgeSize: trigger.size, pointerScale: trigger.pointerScale });
        orbitalBadgeSize = trigger.size;
        orbitalBadgeScale = trigger.pointerScale;
      }
      orbitalBadge.setPreset(trigger.position);
    } else {
      orbitalBadge = mountOrbitalBadge({
        badgeSize: trigger.size,
        pointerScale: trigger.pointerScale,
        initialPreset: trigger.position,
        onPresetChange: (preset: PointerPreset) => { persistBadgePointerPreset(preset); },
        onTipReady: (tip, _preset, badgeCenter) => { orbitalHoverTrigger?.processPoint(tip.x, tip.y, badgeCenter, trigger.size / 2, (trigger.size * (trigger.pointerScale ?? 0.25)) / 2); },
        panelController: deps.panelController,
      });
      orbitalBadgeSize = trigger.size;
      orbitalBadgeScale = trigger.pointerScale;
      // ADR-065: the generic `panelController` is toggled by the badge and
      // manages its own subscription lifecycle.
    }
    // Player Mode transitions do not fire fullscreenchange when the bridge
    // uses its CSS fill fallback or when only the child document marks PM —
    // re-resolve the badge attach target on every sync.
    orbitalBadge?.reattach();
  }

  function dispose(): void {
    pmObserver?.disconnect();
    pmObserver = null;
    teardownBadge();
    listeners.removeAll();
    fullscreenListenerInstalled = false;
  }

  return { sync, teardownBadge, dispose };
}
