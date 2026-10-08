import { overlayRoot, startHostOverlayHoist } from './hostOverlayHoist';

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('overlayRoot', () => {
  it('picks the outermost positioned overlay-named ancestor', () => {
    document.body.innerHTML = `
      <div id="sheet" style="position:fixed">
        <div id="menu" style="position:absolute" class="menu">
          <div id="item"></div>
        </div>
      </div>`;
    const item = document.getElementById('item')!;
    expect(overlayRoot(item)?.id).toBe('sheet');
  });

  it('returns null for non-overlay ancestors', () => {
    document.body.innerHTML = `
      <div style="position:fixed"><div id="item"></div></div>`;
    const item = document.getElementById('item')!;
    expect(overlayRoot(item)).toBeNull();
  });

  it('accepts semantic overlays without name match', () => {
    document.body.innerHTML = `
      <div style="position:absolute"><div role="dialog" id="d" style="position:absolute"><span id="s"></span></div></div>`;
    expect(overlayRoot(document.getElementById('s')!)?.id).toBe('d');
  });
});

describe('startHostOverlayHoist', () => {
  it('hoists a populated document-level overlay into the shadow host', async () => {
    document.body.innerHTML = `
      <div id="app"><div id="host"></div>
        <bottom-sheet-container id="sheet" style="position:fixed"></bottom-sheet-container>
      </div>`;
    const host = document.getElementById('host')!;
    const stop = startHostOverlayHoist(host);
    const sheet = document.getElementById('sheet')!;
    sheet.innerHTML = '<div>content</div>';
    await flush();
    expect(sheet.parentElement).toBe(host);
    expect(sheet.getAttribute('slot')).toBe('cell-host-popup');
    stop();
    expect(sheet.parentElement?.id).toBe('app');
    expect(sheet.hasAttribute('slot')).toBe(false);
  });

  it('hoists an overlay added while active', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host')!;
    const stop = startHostOverlayHoist(host);
    const popup = document.createElement('div');
    popup.className = 'ytp-popup';
    popup.style.position = 'absolute';
    document.body.appendChild(popup);
    await flush();
    expect(popup.parentElement).toBe(host);
    stop();
    expect(popup.parentElement).toBe(document.body);
  });

  it('re-hoists an element the host framework re-inserts elsewhere', async () => {
    document.body.innerHTML = '<div id="app"><div id="host"></div><div id="home"></div></div>';
    const host = document.getElementById('host')!;
    const home = document.getElementById('home')!;
    const stop = startHostOverlayHoist(host);
    const popup = document.createElement('div');
    popup.className = 'dialog';
    popup.style.position = 'fixed';
    home.appendChild(popup);
    await flush();
    expect(popup.parentElement).toBe(host);
    home.appendChild(popup);
    await flush();
    expect(popup.parentElement).toBe(host);
    stop();
    expect(popup.parentElement).toBe(home);
  });

  it('does not hoist persistent chrome named only "menu"', async () => {
    document.body.innerHTML = `
      <div id="host"></div>
      <div class="fullscreen-action-menu" style="position:absolute"><div id="btn"></div></div>`;
    const host = document.getElementById('host')!;
    const stop = startHostOverlayHoist(host);
    const chrome = document.querySelector('.fullscreen-action-menu')!;
    document.getElementById('btn')!.appendChild(document.createElement('span'));
    await flush();
    expect(chrome.parentElement).not.toBe(host);
    stop();
  });

  it('hoists a "menu"-named root that contains a semantic popup', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host')!;
    const stop = startHostOverlayHoist(host);
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'absolute';
    menu.innerHTML = '<div role="menu"></div>';
    document.body.appendChild(menu);
    await flush();
    expect(menu.parentElement).toBe(host);
    stop();
  });

  it('slots an overlay root the framework appended to the host itself', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host')!;
    const stop = startHostOverlayHoist(host);
    const cdk = document.createElement('div');
    cdk.className = 'cdk-overlay-container';
    cdk.style.position = 'fixed';
    host.appendChild(cdk);
    await flush();
    expect(cdk.getAttribute('slot')).toBe('cell-host-popup');
    expect(cdk.parentElement).toBe(host);
    stop();
    expect(cdk.hasAttribute('slot')).toBe(false);
    expect(cdk.parentElement).toBe(document.body);
  });

  it('ignores cell-owned and non-overlay mutations', async () => {
    document.body.innerHTML = `
      <div id="host"></div>
      <div data-cell-id="hint" style="position:fixed" class="menu"></div>
      <div id="plain" style="position:fixed"></div>`;
    const host = document.getElementById('host')!;
    const stop = startHostOverlayHoist(host);
    const hint = document.querySelector('[data-cell-id="hint"]')!;
    const plain = document.getElementById('plain')!;
    hint.setAttribute('class', 'menu open');
    plain.appendChild(document.createElement('span'));
    await flush();
    expect(hint.parentElement).not.toBe(host);
    expect(plain.parentElement).toBe(document.body);
    stop();
  });
});
