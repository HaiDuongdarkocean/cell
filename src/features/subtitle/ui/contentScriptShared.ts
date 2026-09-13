import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { DEFAULT_KEYBOARD_SHORTCUTS, DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE, DEFAULT_SUBTITLE_BLOCK_SETTINGS, DEFAULT_NAV_CLUSTER_SETTINGS, DEFAULT_SETTINGS } from '@/shared/config/config';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { KeyboardShortcut, NavClusterSettings, SubtitleBlockSettings, Settings } from '@/entities/media';

/** Load overlay style + block + cluster settings from chrome.storage.local, fallback to defaults. ADR-013, ADR-025. */
export async function loadOverlaySettings(): Promise<{
  target: OverlayStyleConfig;
  native: OverlayStyleConfig;
  block: SubtitleBlockSettings;
  cluster: NavClusterSettings;
  settings: Settings;
}> {
  try {
    const settings = await loadSettings();
    return {
      target: settings.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET,
      native: settings.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE,
      block: settings.subtitleBlockSettings ?? DEFAULT_SUBTITLE_BLOCK_SETTINGS,
      cluster: {
        enabled: settings.navClusterEnabled,
        buttonSize: settings.navClusterButtonSize,
        textOpacity: settings.navClusterTextOpacity,
        bgOpacity: settings.navClusterButtonBgOpacity,
      },
      settings,
    };
  } catch {
    // ponytail: storage might not be available in test contexts — fallback
    return {
      target: DEFAULT_OVERLAY_STYLE_TARGET,
      native: DEFAULT_OVERLAY_STYLE_NATIVE,
      block: DEFAULT_SUBTITLE_BLOCK_SETTINGS,
      cluster: DEFAULT_NAV_CLUSTER_SETTINGS,
      settings: DEFAULT_SETTINGS,
    };
  }
}

/** Load keyboard shortcuts from chrome.storage.local, fallback to defaults. */
export async function loadShortcuts(): Promise<KeyboardShortcut[]> {
  try {
    const settings = await loadSettings();
    if (settings.keyboardShortcuts?.length && settings.keyboardShortcuts.length > 0) {
      return settings.keyboardShortcuts;
    }
  } catch {
    // ponytail: storage might not be available in test contexts — fallback
  }
  return DEFAULT_KEYBOARD_SHORTCUTS;
}

// YouTube rewrites volatile query params during initial load + SPA nav
// (themeRefresh=1, pp=, list=, t=, tracking). Comparing raw location.href
// treats same-video param churn as a navigation → wipes freshly loaded cues.
// Canonical key = video identity: `v` param for /watch, pathname otherwise.
export function canonicalNavUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('youtube.com') || u.hostname.endsWith('youtube-nocookie.com')) {
      const videoId = u.searchParams.get('v');
      if (videoId) return `${u.origin}/watch?v=${videoId}`;
      return `${u.origin}${u.pathname}`;
    }
    return url;
  } catch {
    return url;
  }
}

// ADR-032 cue-seek dedupe — module-level so multiple init() instances
// (Netflix SPA re-init leaks onMessage listeners, see cleanup ponytail)
// share the same dedupe state. Without this, each instance has its own
// closure state → both seek → "khó sang cue" + "khựng".
let lastCueSeekAction: string | null = null;
let lastCueSeekTs = 0;
const CUE_SEEK_DEDUPE_MS = 300;
export const shouldDedupeCueSeek = (action: string): boolean => {
  const now = Date.now();
  if (action === lastCueSeekAction && now - lastCueSeekTs < CUE_SEEK_DEDUPE_MS) {
    return true;
  }
  lastCueSeekAction = action;
  lastCueSeekTs = now;
  return false;
};

/** Load target/native language codes from settings.
 *  Used by import file role assignment + panel selection. */
export async function loadTargetNativeLangs(): Promise<{ targetLang: string; nativeLang: string }> {
  try {
    const settings = await loadSettings();
    return {
      targetLang: settings.subtitleOverlayTargetLanguage ?? '',
      nativeLang: settings.subtitleOverlayNativeLanguage ?? '',
    };
  } catch {
    return { targetLang: '', nativeLang: '' };
  }
}
