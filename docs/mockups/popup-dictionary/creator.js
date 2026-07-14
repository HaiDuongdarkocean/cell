/* ============================================================
   creator.js — render + interaction of Card Creator workspace
   ============================================================ */

import { iconBtn, iconStr } from './icons.js';
import { FIXTURES, STATUS_CYCLE, STATUS_LABELS } from './fixtures.js';
import { renderPopup, rerenderPopup, createPopupState } from './popup.js';
import { createDropdown } from './dropdown.js';

/** Card Creator state. */
export function createCreatorState() {
  return {
    cardType: 'Sentence',
    deck: 'My Cards',
    mediaUpdate: 'Overwrite',
    settingsOpen: false,
    settings: {
      autoPrefill: true,
      prefillSentence: true,
      prefillTranslation: true,
      prefillSecondarySubs: true,
      prefillVideoAudio: true,
      prefillTts: true,
      ttsAccent: 'US',
      prefillDictAudio: true,
      prefillTtsWord: true,
      ttsAccentWord: 'US',
      prefillScreenshot: true,
      prefillDictImage: true,
      prefillExample: true,
      boldTarget: true,
      sendCardTo: 'anki',
    },
    popupState: createPopupState(),
  };
}

/** Render the workspace (left popup + right creator). */
export function renderWorkspace(container, state, callbacks = {}) {
  const ws = document.createElement('div');
  ws.className = 'workspace';

  // Left pane: popup dictionary
  const left = document.createElement('div');
  left.className = 'workspace__pane workspace__pane--left';
  const leftHeader = document.createElement('div');
  leftHeader.className = 'workspace__pane-header';
  const leftTitle = document.createElement('p');
  leftTitle.className = 'workspace__pane-title';
  leftTitle.textContent = 'Popup Dictionary';
  leftHeader.appendChild(leftTitle);
  left.appendChild(leftHeader);
  const leftBody = document.createElement('div');
  leftBody.className = 'workspace__pane-body';
  leftBody.style.padding = '0';
  left.appendChild(leftBody);
  ws.appendChild(left);

  // Render popup into left body
  const popupCallbacks = {
    onToggleEdit: () => {
      state.popupState.editMode = !state.popupState.editMode;
      rerenderPopup(leftBody, state.popupState, popupCallbacks);
    },
    onPanelToggle: () => rerenderPopup(leftBody, state.popupState, popupCallbacks),
    onSendToCreator: () => callbacks.onToast?.('Already in Card Creator'),
    onQuickAdd: () => callbacks.onQuickAdd?.(),
    onStatusChange: (s) => callbacks.onToast?.(`Status: ${s}`),
    onImageToggle: () => rerenderPopup(leftBody, state.popupState, popupCallbacks),
  };
  renderPopup(leftBody, state.popupState, popupCallbacks);

  // Right pane: card creator
  const right = document.createElement('div');
  right.className = 'workspace__pane workspace__pane--right';
  right.appendChild(renderCreatorHeader(state, callbacks));
  right.appendChild(renderCreatorSubheader(state, callbacks));
  const rightBody = document.createElement('div');
  rightBody.className = 'workspace__pane-body';
  rightBody.appendChild(renderCreatorForm(state, callbacks));
  right.appendChild(rightBody);
  right.appendChild(renderCreatorFooter(state, callbacks));
  ws.appendChild(right);

  container.appendChild(ws);
  return ws;
}

function renderCreatorHeader(state, callbacks) {
  const header = document.createElement('div');
  header.className = 'workspace__pane-header creator-header';

  const title = document.createElement('h2');
  title.className = 'creator-header__title';
  title.textContent = 'Card Creator';
  header.appendChild(title);

  const actions = document.createElement('div');
  actions.className = 'creator-header__actions';
  const settings = iconBtn('settings', 'Card settings');
  settings.addEventListener('click', () => {
    state.settingsOpen = true;
    callbacks.onSettingsOpen?.();
  });
  actions.appendChild(settings);
  const close = iconBtn('close', 'Close Card Creator');
  close.addEventListener('click', () => callbacks.onClose?.());
  actions.appendChild(close);
  header.appendChild(actions);

  return header;
}

function renderCreatorSubheader(state, callbacks) {
  const sh = document.createElement('div');
  sh.className = 'creator-subheader';
  const cardType = makeSelect('Card type', ['Sentence', 'Vocabulary', 'Cloze'], state.cardType, (v) => { state.cardType = v; });
  const deck = makeSelect('Deck', ['My Cards', 'Default', 'Netflix'], state.deck, (v) => { state.deck = v; });
  sh.appendChild(cardType);
  sh.appendChild(deck);
  return sh;
}

function makeSelect(label, options, value, onChange) {
  const row = document.createElement('div');
  row.className = 'creator-subheader__row';
  const lab = document.createElement('span');
  lab.className = 'creator-subheader__label';
  lab.textContent = label;
  row.appendChild(lab);
  const dd = createDropdown({
    ariaLabel: label,
    options: options.map((o) => ({ value: o, label: o })),
    value,
    onChange: (v) => onChange(v),
    width: '120px',
  });
  row.appendChild(dd);
  return row;
}

function renderCreatorPreview(state) {
  const fixture = FIXTURES[state.popupState.fixtureKey] || FIXTURES.hello;
  const preview = document.createElement('div');
  preview.className = 'creator-preview';

  const word = document.createElement('h2');
  word.className = 'creator-preview__word';
  word.textContent = fixture.target;
  preview.appendChild(word);

  if (fixture.sentence) {
    const sent = document.createElement('p');
    sent.className = 'creator-preview__sentence';
    const targetLower = fixture.target.toLowerCase();
    const sentenceLower = fixture.sentence.toLowerCase();
    const idx = sentenceLower.indexOf(targetLower);
    if (idx >= 0 && state.settings.boldTarget) {
      const before = fixture.sentence.slice(0, idx);
      const match = fixture.sentence.slice(idx, idx + fixture.target.length);
      const after = fixture.sentence.slice(idx + fixture.target.length);
      sent.appendChild(document.createTextNode(before));
      const b = document.createElement('b');
      b.textContent = match;
      sent.appendChild(b);
      sent.appendChild(document.createTextNode(after));
    } else {
      sent.textContent = fixture.sentence;
    }
    preview.appendChild(sent);
  }

  return preview;
}

function renderCreatorForm(state, callbacks) {
  const form = document.createElement('div');
  form.className = 'creator-form';

  const fixture = FIXTURES[state.popupState.fixtureKey] || FIXTURES.hello;

  // Preview card
  form.appendChild(renderCreatorPreview(state));

  // Field cards
  form.appendChild(makeFieldCard('Target word', fixture.target, 'modify', callbacks));
  form.appendChild(makeFieldCard('Sentence', fixture.sentence, 'create', callbacks));
  form.appendChild(makeFieldCard('Sentence translation', fixture.sentenceTranslation, 'create', callbacks));
  form.appendChild(makeFieldCard('Definition', fixture.definitions[0]?.text || '', 'search', callbacks));
  form.appendChild(makeAudioCard('Sentence audio', 'create', callbacks));
  form.appendChild(makeAudioCard('Word audio', 'search', callbacks));
  form.appendChild(makeImageCard(callbacks));
  form.appendChild(makeFieldCard('Example sentences', fixture.definitions[0]?.example || '', 'search', callbacks));
  form.appendChild(makeFieldCard('Notes', '', 'create', callbacks));

  return form;
}

function makeFieldCard(label, value, action, callbacks) {
  const card = document.createElement('div');
  card.className = 'creator-field-card';

  const header = document.createElement('div');
  header.className = 'creator-field-card__header';

  const lab = document.createElement('span');
  lab.className = 'creator-field-card__label';
  lab.textContent = label;
  header.appendChild(lab);

  const actions = document.createElement('div');
  actions.className = 'creator-field-card__actions';

  const actionBtn = document.createElement('button');
  actionBtn.className = 'btn btn--ghost';
  actionBtn.type = 'button';
  actionBtn.textContent = action.toUpperCase();
  actionBtn.addEventListener('click', () => callbacks.onToast?.(`${label}: ${action} triggered`));
  actions.appendChild(actionBtn);

  const clearBtn = iconBtn('close', `Clear ${label}`);
  clearBtn.className = 'icon-btn creator-field-card__clear';
  clearBtn.addEventListener('click', () => callbacks.onToast?.(`${label}: clear triggered`));
  actions.appendChild(clearBtn);

  header.appendChild(actions);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'creator-field-card__body';
  const ta = document.createElement('textarea');
  ta.rows = 2;
  ta.value = value;
  body.appendChild(ta);
  card.appendChild(body);

  return card;
}

function makeAudioCard(label, action, callbacks) {
  const card = document.createElement('div');
  card.className = 'creator-field-card creator-media-card';

  const header = document.createElement('div');
  header.className = 'creator-field-card__header';

  const lab = document.createElement('span');
  lab.className = 'creator-field-card__label';
  lab.textContent = label;
  header.appendChild(lab);

  const actions = document.createElement('div');
  actions.className = 'creator-field-card__actions';

  const actionBtn = document.createElement('button');
  actionBtn.className = 'btn btn--ghost';
  actionBtn.type = 'button';
  actionBtn.textContent = action.toUpperCase();
  actionBtn.addEventListener('click', () => callbacks.onToast?.(`${label}: ${action} triggered`));
  actions.appendChild(actionBtn);

  const clearBtn = iconBtn('close', `Clear ${label}`);
  clearBtn.className = 'icon-btn creator-field-card__clear';
  clearBtn.addEventListener('click', () => callbacks.onToast?.(`${label}: clear triggered`));
  actions.appendChild(clearBtn);

  header.appendChild(actions);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'creator-field-card__body';

  const item = document.createElement('div');
  item.className = 'creator-media-row';
  const play = document.createElement('button');
  play.className = 'audio-play';
  play.type = 'button';
  play.innerHTML = `${iconStr('audio', 16)} Andrew (Male from United States)`;
  item.appendChild(play);
  body.appendChild(item);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn--primary creator-media-card__add';
  addBtn.type = 'button';
  addBtn.textContent = '+ ADD';
  addBtn.addEventListener('click', () => callbacks.onToast?.(`${label}: add triggered`));
  body.appendChild(addBtn);

  card.appendChild(body);
  return card;
}

function makeImageCard(callbacks) {
  const card = document.createElement('div');
  card.className = 'creator-field-card creator-media-card';

  const header = document.createElement('div');
  header.className = 'creator-field-card__header';

  const lab = document.createElement('span');
  lab.className = 'creator-field-card__label';
  lab.textContent = 'Images';
  header.appendChild(lab);

  const actions = document.createElement('div');
  actions.className = 'creator-field-card__actions';

  ['ADD', 'SEARCH'].forEach((a) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn--ghost';
    btn.type = 'button';
    btn.textContent = a;
    btn.addEventListener('click', () => callbacks.onToast?.(`Images: ${a} triggered`));
    actions.appendChild(btn);
  });

  const clearBtn = iconBtn('close', 'Clear images');
  clearBtn.className = 'icon-btn creator-field-card__clear';
  clearBtn.addEventListener('click', () => callbacks.onToast?.('Images: clear triggered'));
  actions.appendChild(clearBtn);

  header.appendChild(actions);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'creator-field-card__body';

  const grid = document.createElement('div');
  grid.className = 'creator-image-grid';
  for (let i = 0; i < 2; i++) {
    const thumb = document.createElement('div');
    thumb.className = 'creator-image-grid__thumb';
    thumb.textContent = '🖼';
    grid.appendChild(thumb);
  }
  body.appendChild(grid);

  card.appendChild(body);
  return card;
}

function renderCreatorFooter(state, callbacks) {
  const footer = document.createElement('div');
  footer.className = 'creator-footer';

  const clear = document.createElement('button');
  clear.className = 'btn';
  clear.type = 'button';
  clear.textContent = 'CLEAR FIELDS';
  clear.addEventListener('click', () => callbacks.onToast?.('Clear all fields'));
  footer.appendChild(clear);

  const create = document.createElement('button');
  create.className = 'btn btn--primary';
  create.type = 'button';
  create.textContent = 'CREATE CARD';
  create.addEventListener('click', () => callbacks.onAdd?.(state.settings.sendCardTo));
  footer.appendChild(create);

  return footer;
}

/** Render the settings dialog overlay. */
export function renderSettingsDialog(container, state, callbacks = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  if (state.settingsOpen) overlay.classList.add('is-open');

  const dialog = document.createElement('div');
  dialog.className = 'dialog';

  // Header
  const header = document.createElement('div');
  header.className = 'dialog__header';
  const title = document.createElement('h3');
  title.className = 'dialog__title';
  title.textContent = 'Card settings';
  header.appendChild(title);
  const close = iconBtn('close', 'Close settings');
  close.addEventListener('click', () => {
    state.settingsOpen = false;
    overlay.classList.remove('is-open');
    callbacks.onSettingsClose?.();
  });
  header.appendChild(close);
  dialog.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'dialog__body';

  // Automatic pre-fill (master toggle)
  const prefillSection = document.createElement('div');
  prefillSection.className = 'settings-section';
  const prefillTitle = document.createElement('p');
  prefillTitle.className = 'settings-section__title';
  prefillTitle.textContent = 'Automatic pre-fill';
  prefillSection.appendChild(prefillTitle);
  const toggle = document.createElement('div');
  toggle.className = 'master-toggle';
  ['ON', 'OFF'].forEach((opt) => {
    const b = document.createElement('button');
    b.className = 'master-toggle__opt';
    b.type = 'button';
    b.textContent = opt;
    const isActive = (opt === 'ON' && state.settings.autoPrefill) || (opt === 'OFF' && !state.settings.autoPrefill);
    if (isActive) b.classList.add('is-active');
    b.addEventListener('click', () => {
      state.settings.autoPrefill = (opt === 'ON');
      toggle.querySelectorAll('.master-toggle__opt').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
    });
    toggle.appendChild(b);
  });
  prefillSection.appendChild(toggle);

  // Subsections
  const subs = [
    { key: 'prefillSentence', label: 'Sentence containing Target Word', group: 'SENTENCE' },
    { key: 'prefillTranslation', label: 'Auto translation', group: 'TRANSLATION' },
    { key: 'prefillSecondarySubs', label: 'Secondary subtitles', group: 'TRANSLATION' },
    { group: 'DEFINITIONS' },
    { key: 'prefillVideoAudio', label: 'Video audio', group: 'SENTENCE AUDIO' },
    { key: 'prefillTts', label: 'Text-to-Speech (TTS)', group: 'SENTENCE AUDIO', accent: 'ttsAccent' },
    { key: 'prefillDictAudio', label: 'From dictionary', group: 'WORD AUDIO' },
    { key: 'prefillTtsWord', label: 'Text-to-Speech (TTS)', group: 'WORD AUDIO', accent: 'ttsAccentWord' },
    { key: 'prefillScreenshot', label: 'Video screenshot', group: 'IMAGES' },
    { key: 'prefillDictImage', label: 'Dictionary image search result', group: 'IMAGES' },
    { key: 'prefillExample', label: 'First dictionary example', group: 'EXAMPLE SENTENCES' },
  ];

  let lastGroup = '';
  subs.forEach((s) => {
    if (s.group !== lastGroup) {
      const sub = document.createElement('div');
      sub.className = 'settings-subsection';
      sub.textContent = s.group;
      prefillSection.appendChild(sub);
      lastGroup = s.group;
    }
    if (s.key) {
      const row = document.createElement('div');
      row.className = 'settings-row';
      const lab = document.createElement('div');
      lab.className = 'settings-row__label';
      lab.textContent = s.label;
      row.appendChild(lab);
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'checkbox';
      cb.checked = state.settings[s.key];
      cb.disabled = !state.settings.autoPrefill;
      cb.addEventListener('change', () => { state.settings[s.key] = cb.checked; });
      row.appendChild(cb);
      prefillSection.appendChild(row);
      if (s.accent) {
        const accentRow = document.createElement('div');
        accentRow.className = 'settings-row';
        accentRow.style.paddingLeft = 'var(--space-4)';
        const aLab = document.createElement('div');
        aLab.className = 'settings-row__label';
        aLab.textContent = 'Accent';
        aLab.style.color = 'var(--color-text-muted)';
        aLab.style.fontSize = 'var(--font-size-xs)';
        accentRow.appendChild(aLab);
        const accentDd = createDropdown({
          ariaLabel: 'Accent',
          options: ['US', 'UK'].map((o) => ({ value: o, label: o })),
          value: state.settings[s.accent],
          onChange: (v) => { state.settings[s.accent] = v; },
          disabled: !state.settings.autoPrefill,
          width: '90px',
        });
        accentRow.appendChild(accentDd);
        prefillSection.appendChild(accentRow);
      }
    }
  });

  const reset = document.createElement('button');
  reset.className = 'btn btn--ghost';
  reset.type = 'button';
  reset.textContent = 'Reset defaults';
  reset.style.marginTop = 'var(--space-3)';
  prefillSection.appendChild(reset);
  body.appendChild(prefillSection);

  // Bold target word
  const boldSection = document.createElement('div');
  boldSection.className = 'settings-section';
  const boldTitle = document.createElement('p');
  boldTitle.className = 'settings-section__title';
  boldTitle.textContent = 'Bold target word';
  boldSection.appendChild(boldTitle);
  const boldRow = document.createElement('div');
  boldRow.className = 'settings-row';
  const boldLab = document.createElement('div');
  boldLab.className = 'settings-row__label';
  boldLab.textContent = 'Bold target word in sentence';
  boldRow.appendChild(boldLab);
  const boldCb = document.createElement('input');
  boldCb.type = 'checkbox';
  boldCb.className = 'checkbox';
  boldCb.checked = state.settings.boldTarget;
  boldCb.addEventListener('change', () => { state.settings.boldTarget = boldCb.checked; });
  boldRow.appendChild(boldCb);
  boldSection.appendChild(boldRow);
  body.appendChild(boldSection);

  // Send card to
  const destSection = document.createElement('div');
  destSection.className = 'settings-section';
  const destTitle = document.createElement('p');
  destTitle.className = 'settings-section__title';
  destTitle.textContent = 'Send card to';
  destSection.appendChild(destTitle);
  [
    { value: 'anki', label: 'Anki' },
    { value: 'cell-memory', label: 'Cell Memory (stub)' },
  ].forEach((d) => {
    const row = document.createElement('div');
    row.className = 'radio-row';
    const r = document.createElement('input');
    r.type = 'radio';
    r.name = 'send-card-to';
    r.value = d.value;
    if (d.value === state.settings.sendCardTo) r.checked = true;
    r.addEventListener('change', () => { state.settings.sendCardTo = d.value; });
    row.appendChild(r);
    const lab = document.createElement('span');
    lab.textContent = d.label;
    row.appendChild(lab);
    destSection.appendChild(row);
  });
  body.appendChild(destSection);

  dialog.appendChild(body);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'dialog__footer';
  const done = document.createElement('button');
  done.className = 'btn btn--primary';
  done.type = 'button';
  done.textContent = 'Done';
  done.addEventListener('click', () => {
    state.settingsOpen = false;
    overlay.classList.remove('is-open');
    callbacks.onSettingsClose?.();
  });
  footer.appendChild(done);
  dialog.appendChild(footer);

  overlay.appendChild(dialog);
  container.appendChild(overlay);
  return overlay;
}
