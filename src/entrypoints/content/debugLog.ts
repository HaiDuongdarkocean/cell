import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';

export { isCellDebug } from '@/shared/lib/cellDebug';
import { isCellDebug } from '@/shared/lib/cellDebug';

// ISOLATED content-script marker (verify injection from DevTools — MAIN world
// cannot see this because ISOLATED world globals are not shared with MAIN).
export function markContentScriptInjected(): number {
  const csInjectTime = performance.now();
  if (isCellDebug()) {
    const win = window as unknown as Record<string, unknown>;
    win.__YT_CS_INJECTED = true;
    win.__YT_CS_INJECT_TIME = csInjectTime;
  }
  return csInjectTime;
}

// Debug relay: the player iframe lives cross-origin, so its controller cannot
// set attributes on the top frame. It posts to window.parent; the top frame
// content script stores the last auto-load / scan signal on documentElement.
export function installDebugFrameMessageListener(): void {
  if (window.self === window.top) {
    window.addEventListener('message', (e) => {
      // Debug-only DOM markers (E2E builds, CELL_E2E=1): autoload acknowledgements
      // from player iframes + PAGE_SCAN signals from non-own frames.
      if (isCellDebug()) {
        if (e.data?.type === '__CELL_AUTOLOAD_HANDLED') {
          document.documentElement.setAttribute(
            'data-cell-autoload-handled',
            JSON.stringify({ href: e.data.href, target: e.data.target }),
          );
        }
        const isOwnFrame = e.source === window || e.origin === window.location.origin;
        if (e.data?.type === '__CELL_DEBUG_PAGE_SCAN' && e.data?.pageUrl && !isOwnFrame) {
          document.documentElement.setAttribute(
            'data-cell-iframe-scan',
            JSON.stringify({ pageUrl: e.data.pageUrl, videos: e.data.videoUrls?.length ?? 0, subtitles: e.data.subtitleUrls?.length ?? 0 }),
          );
        }
      }
    });
  }
}

let mediaLogAttempts = 0;
const MAX_MEDIA_LOG_ATTEMPTS = 12;

/** Poll background inventory and mirror it to a debug attribute so E4 checks
 * do not require an extension page or DevTools. Runs in the top frame only. */
async function logDetectedMedia(isTopFrame: boolean): Promise<void> {
  if (!isTopFrame) return;
  if (!isCellDebug()) return;
  try {
    const res: { success?: boolean; data?: { subtitles?: unknown[]; videos?: unknown[] }; error?: string } | undefined =
      await sendMessage({
        type: MESSAGE_TYPES.GET_DETECTED_MEDIA,
        payload: {},
      });
    const value = {
      t: Date.now(),
      subtitles: res?.success ? (res.data?.subtitles?.length ?? 0) : undefined,
      videos: res?.success ? (res.data?.videos?.length ?? 0) : undefined,
      subtitleList: res?.success
        ? res.data?.subtitles?.slice(0, 10).map((s: unknown) => {
            const sub = s as { url?: string; language?: string; label?: string };
            return {
              url: sub.url?.slice(0, 120),
              language: sub.language,
              label: sub.label,
            };
          })
        : undefined,
      error: res?.success ? undefined : (res?.error ?? 'no response'),
    };
    document.documentElement.setAttribute('data-cell-debug-media', JSON.stringify(value));
  } catch (err) {
    document.documentElement.setAttribute(
      'data-cell-debug-media',
      JSON.stringify({ t: Date.now(), error: String(err).slice(0, 200) }),
    );
  }
}

export function scheduleMediaLog(isTopFrame: boolean): void {
  if (!isTopFrame) return;
  if (!isCellDebug()) return;
  setTimeout(() => {
    mediaLogAttempts++;
    void logDetectedMedia(isTopFrame);
    if (mediaLogAttempts < MAX_MEDIA_LOG_ATTEMPTS) scheduleMediaLog(isTopFrame);
  }, 5000);
}
