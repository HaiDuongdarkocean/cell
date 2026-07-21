import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?raw';
import { ICON_CATALOG } from '@/shared/icons';
import { buildTokenBadgeCss } from './tokenBadgeCss';
import { onStorageChanged, removeOnStorageChangedListener, getStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { ThemeMode } from '@/entities/theme';

const HOST_CLASS = 'js-cell-token-badge-host';
const BADGE_Z_INDEX = '2147483646';

export interface TokenBadgeState {
  enabled: boolean;
  showStatus: boolean;
  showFrequency: boolean;
}

export interface TokenBadgeHandlers {
  onToggleEnabled: () => void;
  onToggleStatus: () => void;
  onToggleFrequency: () => void;
  onOpenDictionary: () => void;
}

export interface TokenBadge {
  setState(state: Partial<TokenBadgeState>): void;
  destroy(): void;
}

export interface CreateTokenBadgeOptions extends TokenBadgeHandlers {
  initialState: TokenBadgeState;
}

/**
 * Create a floating tokenize badge (FAB) with a Shadow DOM mini panel.
 *
 * ponytail: drag-to-reposition is intentionally omitted in this slice to keep
 * the first version testable in jsdom; the panel opens/closes via FAB click.
 *
 * Theme: data-theme is set on the panel element inside the shadow tree so
 * [data-theme="dark"] selectors in tokens.css match and cascade. Listens to
 * chrome.storage.onChanged + matchMedia for real-time theme switching.
 */
export function createTokenBadge(options: CreateTokenBadgeOptions): TokenBadge {
  let state = { ...options.initialState };
  let isOpen = false;
  let themeCleanup: (() => void) | null = null;

  const host = document.createElement('div');
  host.className = HOST_CLASS;
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = '0';
  host.style.height = '0';
  host.style.zIndex = BADGE_Z_INDEX;

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `${tokensCss.replace(/:root/g, ':host')}\n${componentsCss}\n${buildTokenBadgeCss()}`;
  shadow.appendChild(style);

  const fab = document.createElement('button');
  // .btn--primary provides bg/color/hover/active; .cell-token-fab adds floating layout.
  fab.className = 'btn btn--primary cell-token-fab js-cell-token-fab';
  fab.setAttribute('aria-label', 'Tokenize');
  fab.innerHTML = ICON_CATALOG.messageSquare.svg;
  shadow.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'cell-token-panel js-cell-token-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Tokenize settings');
  shadow.appendChild(panel);

  /** Resolve theme mode (system → matchMedia, else stored mode, default dark). */
  function resolveTheme(mode: ThemeMode | undefined): 'light' | 'dark' {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode ?? 'dark';
  }

  /** Read themeMode from storage and set data-theme on the panel element. */
  async function refreshTheme(): Promise<void> {
    const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.THEME_MODE);
    const mode = data[STORAGE_KEYS.THEME_MODE] as ThemeMode | undefined;
    panel.setAttribute('data-theme', resolveTheme(mode));
  }

  /** Initialize theme detection + listeners. Called once after host append. */
  function initTheme(): void {
    // Sync initial — prefers-color-scheme avoids FOUC for 'system' mode users.
    const syncDefault = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    panel.setAttribute('data-theme', syncDefault);

    // Async-correct from storage.
    void refreshTheme();

    // Re-resolve when themeMode changes in storage (user toggled in settings).
    const onThemeChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'local') return;
      if (STORAGE_KEYS.THEME_MODE in changes) void refreshTheme();
    };
    onStorageChanged(onThemeChange);

    // Re-resolve when OS theme changes (matters when mode='system').
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (): void => { void refreshTheme(); };
    mql.addEventListener('change', onSystemChange);

    themeCleanup = (): void => {
      removeOnStorageChangedListener(onThemeChange);
      mql.removeEventListener('change', onSystemChange);
    };
  }

  function buildPanel(): void {
    panel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'cell-token-panel__header';
    header.textContent = 'Tokenize';

    const closeBtn = document.createElement('button');
    // .icon-btn--xs provides size/hover/active; .cell-token-panel__close is a BEM hook.
    closeBtn.className = 'icon-btn icon-btn--xs cell-token-panel__close js-cell-token-panel-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = ICON_CATALOG.x.svg;
    closeBtn.addEventListener('click', () => setOpen(false));
    header.appendChild(closeBtn);
    panel.appendChild(header);

    panel.appendChild(createToggleRow('Tokenize page', state.enabled, () => options.onToggleEnabled()));
    panel.appendChild(createToggleRow('Status', state.showStatus, () => options.onToggleStatus()));
    panel.appendChild(createToggleRow('Frequency', state.showFrequency, () => options.onToggleFrequency()));

    const dictBtn = document.createElement('button');
    // .btn--primary provides bg/color/hover/active; .cell-token-action adds full-width.
    dictBtn.className = 'btn btn--primary cell-token-action js-cell-token-open-dict';
    dictBtn.textContent = 'Open Dictionary';
    dictBtn.addEventListener('click', () => options.onOpenDictionary());
    panel.appendChild(dictBtn);
  }

  function createToggleRow(label: string, pressed: boolean, onChange: () => void): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'cell-token-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'cell-token-row__label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    // DS Toggle pattern: <button aria-pressed> + .cell-toggle__thumb span.
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'cell-toggle js-cell-token-toggle';
    toggle.setAttribute('aria-pressed', String(pressed));
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', label);
    const thumb = document.createElement('span');
    thumb.className = 'cell-toggle__thumb';
    toggle.appendChild(thumb);
    toggle.addEventListener('click', () => {
      const next = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(next));
      onChange();
    });
    row.appendChild(toggle);

    return row;
  }

  function setOpen(open: boolean): void {
    isOpen = open;
    if (open) {
      buildPanel();
      panel.classList.add('cell-token-panel--open');
    } else {
      panel.classList.remove('cell-token-panel--open');
    }
  }

  fab.addEventListener('click', () => setOpen(!isOpen));

  // Append the badge host after the page (and Angular/Cloudflare hydration)
  // has finished loading. Appending during hydration can cause DOM
  // mismatches that break script injection and leave the page stuck.
  function appendHost(): void {
    (document.body ?? document.documentElement).appendChild(host);
    initTheme();
  }
  if (document.readyState === 'complete') {
    appendHost();
  } else {
    window.addEventListener('load', () => appendHost(), { once: true });
  }
  buildPanel();

  return {
    setState(next: Partial<TokenBadgeState>) {
      state = { ...state, ...next };
      buildPanel();
    },
    destroy() {
      themeCleanup?.();
      themeCleanup = null;
      host.remove();
    },
  };
}
