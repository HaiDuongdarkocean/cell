import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?raw';
import { ICON_CATALOG } from '@/shared/icons';
import { buildTokenBadgeCss } from './tokenBadgeCss';

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
 */
export function createTokenBadge(options: CreateTokenBadgeOptions): TokenBadge {
  let state = { ...options.initialState };
  let isOpen = false;

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
  fab.className = 'cell-token-fab js-cell-token-fab';
  fab.setAttribute('aria-label', 'Tokenize');
  fab.innerHTML = ICON_CATALOG.messageSquare.svg;
  shadow.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'cell-token-panel js-cell-token-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Tokenize settings');
  shadow.appendChild(panel);

  function buildPanel(): void {
    panel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'cell-token-panel__header';
    header.textContent = 'Tokenize';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'cell-token-panel__close js-cell-token-panel-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = ICON_CATALOG.x.svg;
    closeBtn.addEventListener('click', () => setOpen(false));
    header.appendChild(closeBtn);
    panel.appendChild(header);

    panel.appendChild(createToggleRow('Tokenize page', state.enabled, () => options.onToggleEnabled()));
    panel.appendChild(createToggleRow('Status', state.showStatus, () => options.onToggleStatus()));
    panel.appendChild(createToggleRow('Frequency', state.showFrequency, () => options.onToggleFrequency()));

    const dictBtn = document.createElement('button');
    dictBtn.className = 'cell-token-action js-cell-token-open-dict';
    dictBtn.textContent = 'Open Dictionary';
    dictBtn.addEventListener('click', () => options.onOpenDictionary());
    panel.appendChild(dictBtn);
  }

  function createToggleRow(label: string, checked: boolean, onChange: () => void): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'cell-token-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'cell-token-row__label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'cell-token-toggle js-cell-token-toggle';
    toggle.checked = checked;
    toggle.addEventListener('change', onChange);
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
      host.remove();
    },
  };
}
