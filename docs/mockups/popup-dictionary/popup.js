/* ============================================================
   popup.js — render + interaction of Dictionary Popup
   ============================================================ */

import { iconBtn, iconStr, iconEl } from './icons.js';
import { FIXTURES, STATUS_CYCLE, STATUS_LABELS, PANEL_IDS, PANEL_LABELS } from './fixtures.js';
import { createDropdown } from './dropdown.js';

/** State of the popup instance. */
export function createPopupState() {
  return {
    fixtureKey: 'hello',
    editMode: false,
    activePanel: null, // null | 'audio' | 'image' | 'translate' | 'links'
    selectedDefs: new Set([1, 2]),
    selectedImages: new Set([1]),
    status: 'unknown',
    config: {
      defaultPanel: 'dictionary',
      trigger: 'click',
      hoverDelay: 300,
      srsDestination: 'anki',
      audioAccent: 'US',
      autoPlay: false,
      maxImages: 20,
      imageSource: 'google',
      translateTarget: 'Vietnamese',
      translateSource: 'auto',
      linksEn: ['cambridge', 'oxford', 'wiktionary'],
      linksZh: ['mdbg', 'wiktionary'],
    },
  };
}

/** Render the popup into a container. Returns the popup element. */
export function renderPopup(container, state, callbacks = {}) {
  const fixture = FIXTURES[state.fixtureKey] || FIXTURES.hello;
  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', `Dictionary popup for ${fixture.target}`);
  if (state.editMode) popup.classList.add('is-edit');

  popup.appendChild(renderHeader(fixture, state, callbacks));
  popup.appendChild(renderToolbar(state, callbacks));
  popup.appendChild(renderBody(fixture, state, callbacks));
  popup.appendChild(renderFooter(fixture, state, callbacks));

  container.appendChild(popup);
  return popup;
}

function renderHeader(fixture, state, callbacks) {
  const header = document.createElement('div');
  header.className = 'popup__header';

  // Contract html_skeleton: header-meta (target + reading + badges) + actions
  const meta = document.createElement('div');
  meta.className = 'popup__header-meta';

  const target = document.createElement('div');
  target.className = 'popup__target';
  const word = document.createElement('h2');
  word.className = 'popup__word';
  word.textContent = fixture.target;
  target.appendChild(word);
  meta.appendChild(target);

  if (fixture.reading) {
    const reading = document.createElement('p');
    reading.className = 'popup__reading';
    reading.textContent = fixture.reading;
    meta.appendChild(reading);
  }

  const badges = document.createElement('div');
  badges.className = 'popup__badges';

  const statusDropdown = createDropdown({
    ariaLabel: 'Word status',
    options: STATUS_CYCLE.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    value: state.status,
    onChange: (v) => { state.status = v; callbacks.onStatusChange?.(v); },
    width: '140px',
  });
  badges.appendChild(statusDropdown);

  if (fixture.frequency) {
    const freq = document.createElement('span');
    freq.className = 'badge badge--primary';
    freq.textContent = `#${fixture.frequency.rank} · ${fixture.frequency.source}`;
    badges.appendChild(freq);
  }

  meta.appendChild(badges);
  header.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'popup__actions';
  const settingsBtn = iconBtn('settings', 'Settings (edit mode)');
  settingsBtn.setAttribute('data-action', 'settings');
  if (state.editMode) settingsBtn.classList.add('is-active');
  settingsBtn.addEventListener('click', () => callbacks.onToggleEdit?.());
  actions.appendChild(settingsBtn);

  const cardBtn = iconBtn('sendToCreator', 'Send to Card Creator');
  cardBtn.setAttribute('data-action', 'send-to-creator');
  cardBtn.addEventListener('click', () => callbacks.onSendToCreator?.());
  actions.appendChild(cardBtn);

  const addBtn = iconBtn('quickAdd', 'Quick Add');
  addBtn.setAttribute('data-action', 'quick-add');
  addBtn.classList.add('popup__quick-add');
  addBtn.addEventListener('click', () => callbacks.onQuickAdd?.());
  actions.appendChild(addBtn);

  header.appendChild(actions);
  return header;
}

function renderToolbar(state, callbacks) {
  const toolbar = document.createElement('div');
  toolbar.className = 'popup__toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Popup panels');

  PANEL_IDS.forEach((id) => {
    const btn = iconBtn(id, PANEL_LABELS[id]);
    btn.setAttribute('data-panel', id);
    if (state.activePanel === id) btn.classList.add('is-active');
    btn.addEventListener('click', () => {
      state.activePanel = state.activePanel === id ? null : id;
      callbacks.onPanelToggle?.(state.activePanel);
    });
    toolbar.appendChild(btn);
  });

  return toolbar;
}

function renderBody(fixture, state, callbacks) {
  const body = document.createElement('div');
  body.className = 'popup__body';

  // Layout order per contract: Panel (if any) → Panel config footer (if any) → General config → Definitions
  if (state.activePanel) {
    body.appendChild(renderPanel(fixture, state, callbacks));
    if (state.editMode) body.appendChild(renderPanelConfig(state, callbacks));
  }

  if (state.editMode) body.appendChild(renderGeneralConfig(state, callbacks));

  body.appendChild(renderDefinitions(fixture, state, callbacks));

  return body;
}

function renderPanel(fixture, state, callbacks) {
  const panel = document.createElement('div');
  panel.className = 'panel';

  const body = document.createElement('div');
  body.className = 'panel__body';

  switch (state.activePanel) {
    case 'audio': renderAudioPanel(fixture, body); break;
    case 'image': renderImagePanel(fixture, state, body, callbacks); break;
    case 'translate': renderTranslatePanel(fixture, state, body); break;
    case 'links': renderLinksPanel(fixture, body); break;
  }

  panel.appendChild(body);
  return panel;
}

function renderAudioPanel(fixture, body) {
  const sections = [
    { key: 'word', title: 'PLAY WORD' },
    { key: 'sentence', title: 'PLAY SENTENCE' },
  ];

  let hasAny = false;
  sections.forEach(({ key, title }) => {
    const items = fixture.audio[key] || [];
    if (items.length === 0) return;
    hasAny = true;
    const secTitle = document.createElement('div');
    secTitle.className = 'audio-section__title';
    secTitle.textContent = title;
    body.appendChild(secTitle);

    items.forEach((a) => {
      const item = document.createElement('div');
      item.className = 'audio-item';
      const playWrap = document.createElement('button');
      playWrap.className = 'audio-play-btn';
      playWrap.type = 'button';
      playWrap.setAttribute('aria-label', `Play ${a.label}`);
      playWrap.innerHTML = iconStr('audio', 14);
      playWrap.addEventListener('click', () => {
        playWrap.innerHTML = iconStr('audio', 14);
        setTimeout(() => { playWrap.innerHTML = iconStr('play', 14); }, 1000);
      });
      item.appendChild(playWrap);
      const label = document.createElement('span');
      label.className = 'audio-item__label';
      label.textContent = a.label;
      item.appendChild(label);
      body.appendChild(item);
    });
  });

  if (!hasAny) {
    body.appendChild(renderEmpty('No audio available', 'No audio recordings found for this word.', 'Use TTS'));
  }
}

function renderImagePanel(fixture, state, body, callbacks) {
  if (!fixture.images.length) {
    body.appendChild(renderEmpty('No images', 'No images found for this word.', 'Open search'));
    return;
  }
  const strip = document.createElement('div');
  strip.className = 'image-strip';
  fixture.images.forEach((img) => {
    const thumb = document.createElement('div');
    thumb.className = 'image-thumb';
    thumb.setAttribute('role', 'checkbox');
    thumb.setAttribute('aria-label', img.alt);
    thumb.setAttribute('aria-checked', state.selectedImages.has(img.id));
    if (state.selectedImages.has(img.id)) thumb.classList.add('is-selected');
    thumb.addEventListener('click', () => {
      if (state.selectedImages.has(img.id)) state.selectedImages.delete(img.id);
      else state.selectedImages.add(img.id);
      callbacks.onImageToggle?.(img.id);
    });
    strip.appendChild(thumb);
  });
  body.appendChild(strip);
}

function renderTranslatePanel(fixture, state, body) {
  if (!fixture.translation) {
    body.appendChild(renderEmpty('Translation unavailable', 'Translation could not be loaded.', 'Retry'));
    return;
  }

  const noneTarget = state.config.translateTarget === 'None';

  const card = document.createElement('div');
  card.className = 'translate-card';
  const copy = iconBtn('copy', 'Copy translation');
  copy.className = 'icon-btn translate-card__copy';
  copy.addEventListener('click', () => navigator.clipboard?.writeText(fixture.translation.target));
  card.appendChild(copy);
  const source = document.createElement('p');
  source.className = 'translate-card__source';
  source.textContent = fixture.translation.source;
  card.appendChild(source);
  if (!noneTarget) {
    const target = document.createElement('p');
    target.className = 'translate-card__target';
    target.textContent = fixture.translation.target;
    card.appendChild(target);
  }
  body.appendChild(card);
}

function renderLinksPanel(fixture, body) {
  if (!fixture.links.length) {
    body.appendChild(renderEmpty('No external dictionaries', 'No external dictionaries configured yet.', 'Configure'));
    return;
  }
  fixture.links.forEach((l) => {
    const item = document.createElement('div');
    item.className = 'link-item';
    const label = document.createElement('span');
    label.className = 'link-item__label';
    label.textContent = l.label;
    item.appendChild(label);
    const ext = iconBtn('external', `Open ${l.label} in new tab`);
    item.appendChild(ext);
    body.appendChild(item);
  });
}

function renderPanelConfig(state, callbacks) {
  const footer = document.createElement('div');
  footer.className = 'config-footer';

  const configs = {
    audio: [
      { label: 'Accent (EN)', type: 'select', value: state.config.audioAccent, options: ['US', 'UK'] },
      { label: 'Auto-play on open', type: 'checkbox', value: state.config.autoPlay },
    ],
    image: [
      { label: 'Max images', type: 'number', value: state.config.maxImages },
      { label: 'Source', type: 'select', value: state.config.imageSource, options: ['google', 'bing'] },
    ],
    translate: [
      { label: 'Target', type: 'select', value: state.config.translateTarget, options: ['None', 'Vietnamese', 'English'] },
      { label: 'Source', type: 'select', value: state.config.translateSource, options: ['None', 'auto', 'english'] },
    ],
    links: [
      { label: 'English', type: 'text', value: state.config.linksEn.join(', ') },
      { label: 'Chinese', type: 'text', value: state.config.linksZh.join(', ') },
    ],
  };

  (configs[state.activePanel] || []).forEach((c) => {
    const row = document.createElement('div');
    row.className = 'config-footer__row';
    const label = document.createElement('span');
    label.className = 'config-footer__label';
    label.textContent = c.label;
    row.appendChild(label);
    if (c.type === 'select') {
      const dd = createDropdown({
        ariaLabel: c.label,
        options: c.options.map((o) => ({ value: o, label: o })),
        value: c.value,
        onChange: () => {},
        width: '110px',
      });
      row.appendChild(dd);
    } else if (c.type === 'checkbox') {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'checkbox';
      cb.checked = c.value;
      row.appendChild(cb);
    } else if (c.type === 'number') {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'select';
      inp.value = c.value;
      inp.style.width = '60px';
      row.appendChild(inp);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'select';
      inp.value = c.value;
      row.appendChild(inp);
    }
    footer.appendChild(row);
  });

  return footer;
}

function renderGeneralConfig(state, callbacks) {
  const cfg = document.createElement('div');
  cfg.className = 'general-config';

  const title = document.createElement('p');
  title.className = 'general-config__title';
  title.textContent = 'General';
  cfg.appendChild(title);

  const row = document.createElement('div');
  row.className = 'general-config__row';

  const items = [
    { label: 'Default panel', type: 'select', value: state.config.defaultPanel, options: ['dictionary', 'audio', 'image', 'translate', 'links'] },
    { label: 'Trigger', type: 'select', value: state.config.trigger, options: ['click', 'hover'] },
    { label: 'Hover delay (ms)', type: 'number', value: state.config.hoverDelay },
    { label: 'SRS destination', type: 'select', value: state.config.srsDestination, options: ['anki', 'cell-memory'] },
  ];

  items.forEach((c) => {
    const wrap = document.createElement('div');
    wrap.className = 'config-footer__row';
    const lab = document.createElement('span');
    lab.className = 'config-footer__label';
    lab.textContent = c.label;
    wrap.appendChild(lab);
    if (c.type === 'select') {
      const dd = createDropdown({
        ariaLabel: c.label,
        options: c.options.map((o) => ({ value: o, label: o })),
        value: c.value,
        onChange: () => {},
        width: '120px',
      });
      wrap.appendChild(dd);
    } else {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'select';
      inp.value = c.value;
      inp.style.width = '70px';
      wrap.appendChild(inp);
    }
    row.appendChild(wrap);
  });

  cfg.appendChild(row);
  return cfg;
}

function renderDefinitions(fixture, state, callbacks) {
  const wrap = document.createElement('div');
  wrap.className = 'definitions';

  const title = document.createElement('p');
  title.className = 'definitions__title';
  title.textContent = 'Definitions';
  wrap.appendChild(title);

  if (!fixture.definitions.length) {
    const empty = renderEmpty(
      'No definitions found',
      `We couldn't find definitions for "${fixture.target}".`,
      'Try external dictionaries →',
      () => { state.activePanel = 'links'; callbacks.onPanelToggle?.('links'); }
    );
    wrap.appendChild(empty);
    return wrap;
  }

  fixture.definitions.forEach((d) => {
    const item = document.createElement('div');
    item.className = 'def-item';
    item.setAttribute('role', 'checkbox');
    item.setAttribute('aria-checked', String(state.selectedDefs.has(d.id)));
    item.setAttribute('tabindex', '0');
    if (state.selectedDefs.has(d.id)) item.classList.add('is-selected');

    // Tap-to-select: toggle on click (skip if user is selecting text)
    item.addEventListener('click', () => {
      if (!window.getSelection().isCollapsed) return;
      if (state.selectedDefs.has(d.id)) state.selectedDefs.delete(d.id);
      else state.selectedDefs.add(d.id);
      item.classList.toggle('is-selected');
      item.setAttribute('aria-checked', String(state.selectedDefs.has(d.id)));
    });
    // Keyboard a11y: Space/Enter toggle
    item.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        item.click();
      }
    });

    const body = document.createElement('div');
    body.className = 'def-item__body';
    const text = document.createElement('p');
    text.className = 'def-item__text';
    if (d.pos) {
      const pos = document.createElement('span');
      pos.className = 'def-item__pos';
      pos.textContent = `(${d.pos}) `;
      text.appendChild(pos);
    }
    text.appendChild(document.createTextNode(d.text));
    body.appendChild(text);

    if (d.example) {
      const ex = document.createElement('p');
      ex.className = 'def-item__example';
      ex.textContent = `"${d.example}"`;
      body.appendChild(ex);
    }

    item.appendChild(body);
    wrap.appendChild(item);
  });

  return wrap;
}

function renderEmpty(title, desc, actionText, onAction) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';

  const icon = document.createElement('span');
  icon.className = 'empty-state__icon';
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
  empty.appendChild(icon);

  const titleEl = document.createElement('h3');
  titleEl.className = 'empty-state__title';
  titleEl.textContent = title;
  empty.appendChild(titleEl);

  if (desc) {
    const descEl = document.createElement('p');
    descEl.className = 'empty-state__desc';
    descEl.textContent = desc;
    empty.appendChild(descEl);
  }

  if (actionText) {
    const action = document.createElement('button');
    action.className = 'empty-state__action';
    action.textContent = actionText;
    if (onAction) action.addEventListener('click', onAction);
    empty.appendChild(action);
  }
  return empty;
}

function renderFooter(fixture, state, callbacks) {
  const footer = document.createElement('div');
  footer.className = 'popup__footer';
  return footer;
}

/** Re-render the popup (called after state change). */
export function rerenderPopup(container, state, callbacks) {
  const old = container.querySelector('.popup');
  if (old) old.remove();
  return renderPopup(container, state, callbacks);
}
