// popupContent — renders active entry + candidates + footer into the popup shell.
//
// Spec redesign: spec-popup-dictionary-redesign.md
// Structure: active-entry (header 3-row + definitions) + materials slot +
//            candidates (chips + expand list) + footer (status + send + settings).
//
// Content-script isolated world — vanilla DOM rendered into Shadow DOM.

import type { LookupResult, DefinitionEntry, WordStatus } from '../types';
import { nextStatus } from '../services/wordStatusStore';
import { ICON_CATALOG } from '@/shared/icons';
import { rankToBand } from '@/shared/lib/frequencyBand';

// Design system §9 Status badge — soft pill per WordStatus.
// BEM modifier classes: .cell-header__status--<status>
//   unknown=error, tracking=warning, known=success, ignore=neutral

/** Selection state for definitions (checkboxes). */
export type DefinitionSelection = Map<string, boolean>;

/** Callbacks for popup content (header + footer + candidates). */
export interface PopupContentCallbacks {
  onStatusCycle: () => void;
  onDefinitionToggle: (id: string, selected: boolean) => void;
  onQuickAdd: () => void;
  onSendToCreator: () => void;
  onSettings: () => void;
  onClose?: () => void;
  onPlayTerm?: () => void;
  /** Play sentence audio from header. */
  onPlaySentence?: () => void;
  /** Click chip → switch active candidate. */
  onCandidateSelect?: (idx: number) => void;
}

/** Render the popup header: 2-row layout (spec redesign v3).
 *  Row 1: word + reading-row(IPA + audio-group) + actions (QuickAdd + SendToCard + 3-dot menu + Close)
 *  Row 2: second header (badges + status, scroll main axis if overflow)
 */
export function renderHeader(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  onStatusCycle: () => void,
  onQuickAdd: () => void,
  onSendToCreator: () => void,
  onSettings: () => void,
  onClose?: () => void,
  onPlayTerm?: () => void,
  onPlaySentence?: () => void,
): void {
  const header = document.createElement('div');
  header.className = 'cell-header js-cell-header';

  // === Row 1: word-row + IPA + audio-group + actions ===
  const row = document.createElement('div');
  row.className = 'cell-header__row';

  // Main group: word + reading-row (IPA + audio buttons)
  const main = document.createElement('div');
  main.className = 'cell-header__main';

  // word-row: word only, truncates with ellipsis.
  const wordRow = document.createElement('div');
  wordRow.className = 'cell-header__word-row';

  const word = document.createElement('span');
  word.className = 'cell-header__word js-cell-term';
  word.textContent = result.term;
  word.id = 'cell-popup-term';
  wordRow.appendChild(word);
  main.appendChild(wordRow);

  // Reading row: IPA + audio buttons; wraps under the word when header is narrow.
  const readingRow = document.createElement('div');
  readingRow.className = 'cell-header__reading';

  if (result.reading) {
    const ipa = document.createElement('span');
    ipa.className = 'cell-header__ipa js-cell-reading';
    // Wrap IPA in /.../ when readingKind is 'ipa' (don't double-wrap if already slashed)
    if (result.readingKind === 'ipa' && !(result.reading.startsWith('/') && result.reading.endsWith('/'))) {
      ipa.textContent = `/${result.reading}/`;
    } else {
      ipa.textContent = result.reading;
    }
    readingRow.appendChild(ipa);
  }

  // Audio group: word audio + sentence audio, close together
  if (onPlayTerm || onPlaySentence) {
    const audioGroup = document.createElement('div');
    audioGroup.className = 'cell-header__audio-group';

    if (onPlayTerm) {
      const playBtn = document.createElement('button');
      playBtn.className = 'icon-btn icon-btn--xs cell-header__audio js-cell-play-term';
      playBtn.setAttribute('aria-label', 'Play word audio');
      playBtn.title = 'Play word audio';
      playBtn.innerHTML = ICON_CATALOG.audioWave.svg;
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onPlayTerm();
      });
      audioGroup.appendChild(playBtn);
    }

    if (onPlaySentence) {
      const sentenceBtn = document.createElement('button');
      sentenceBtn.className = 'icon-btn icon-btn--xs cell-header__audio js-cell-play-sentence';
      sentenceBtn.setAttribute('aria-label', 'Play sentence audio');
      sentenceBtn.title = 'Play sentence audio';
      sentenceBtn.innerHTML = ICON_CATALOG.messageSquare.svg;
      sentenceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onPlaySentence();
      });
      audioGroup.appendChild(sentenceBtn);
    }
    readingRow.appendChild(audioGroup);
  }

  if (readingRow.hasChildNodes()) {
    main.appendChild(readingRow);
  }

  row.appendChild(main);

  // Actions: Quick Add (icon only) + Send to Card (icon only) + 3-dot menu + Close
  const actions = document.createElement('div');
  actions.className = 'cell-header__actions';

  const quickAdd = document.createElement('button');
  quickAdd.className = 'icon-btn icon-btn--sm icon-btn--filled cell-header__quick-add js-cell-quick-add';
  quickAdd.setAttribute('aria-label', 'Quick Add to Anki');
  quickAdd.title = 'Quick Add to Anki';
  quickAdd.innerHTML = ICON_CATALOG.zap.svg;
  quickAdd.addEventListener('click', onQuickAdd);
  actions.appendChild(quickAdd);

  // Send to Card — icon only, after Quick Add.
  const sendBtn = document.createElement('button');
  sendBtn.className = 'icon-btn icon-btn--sm icon-btn--outlined cell-header__send js-cell-send-to-creator';
  sendBtn.setAttribute('aria-label', 'Send to Card Creator');
  sendBtn.title = 'Send to Card Creator';
  sendBtn.innerHTML = ICON_CATALOG.pencil.svg;
  sendBtn.addEventListener('click', onSendToCreator);
  actions.appendChild(sendBtn);

  // 3-dot menu (kebab) — dropdown with Settings.
  const menuWrapper = document.createElement('div');
  menuWrapper.className = 'cell-header__menu-wrapper js-cell-menu-wrapper';

  const menuBtn = document.createElement('button');
  menuBtn.className = 'icon-btn icon-btn--sm cell-header__menu-btn js-cell-menu-btn';
  menuBtn.setAttribute('aria-label', 'More options');
  menuBtn.title = 'More options';
  menuBtn.innerHTML = ICON_CATALOG.ellipsisVertical.svg;
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = menuWrapper.querySelector('.js-cell-menu-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('cell-menu-dropdown--open');
    }
  });
  menuWrapper.appendChild(menuBtn);

  // Dropdown menu.
  const dropdown = document.createElement('div');
  dropdown.className = 'cell-menu-dropdown js-cell-menu-dropdown';
  const settingsItem = document.createElement('button');
  settingsItem.className = 'cell-menu-dropdown__item js-cell-settings';
  settingsItem.setAttribute('aria-label', 'Popup dictionary settings');
  settingsItem.innerHTML = `${ICON_CATALOG.settings.svg}<span>Settings</span>`;
  settingsItem.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.remove('cell-menu-dropdown--open');
    onSettings();
  });
  dropdown.appendChild(settingsItem);
  menuWrapper.appendChild(dropdown);

  // Close dropdown on outside click.
  document.addEventListener('click', () => {
    dropdown.classList.remove('cell-menu-dropdown--open');
  }, { once: true });

  actions.appendChild(menuWrapper);

  if (onClose) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn icon-btn--sm js-cell-close';
    closeBtn.setAttribute('aria-label', 'Close popup dictionary');
    closeBtn.title = 'Close popup dictionary';
    closeBtn.innerHTML = ICON_CATALOG.x.svg;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClose();
    });
    actions.appendChild(closeBtn);
  }

  row.appendChild(actions);
  header.appendChild(row);

  // === Row 2: second header — badges + status (scroll main axis if overflow) ===
  const second = document.createElement('div');
  second.className = 'cell-header__second';

  // Status badge — clickable cycle (LEFT of badges per UX)
  const statusBadge = document.createElement('button');
  statusBadge.className = `btn cell-header__status cell-header__status--${currentStatus} js-cell-status`;
  const next = nextStatus(currentStatus);
  statusBadge.title = `Click to cycle: ${currentStatus} → ${next}`;
  statusBadge.addEventListener('click', onStatusCycle);
  statusBadge.textContent = currentStatus;
  second.appendChild(statusBadge);

  // Frequency badges (RIGHT of status)
  if (result.frequency) {
    const badges = document.createElement('div');
    badges.className = 'cell-header__badges';
    const band = rankToBand(result.frequency.rank);
    const freq = document.createElement('span');
    freq.className = `cell-header__frequency js-cell-frequency cell-header__frequency--${band}`;
    const src = document.createElement('span');
    src.className = 'cell-header__frequency-source';
    src.textContent = result.frequency.source;
    const rank = document.createElement('span');
    rank.className = 'cell-header__frequency-rank';
    rank.textContent = result.frequency.rank.toLocaleString();
    freq.appendChild(src);
    freq.appendChild(rank);
    badges.appendChild(freq);
    second.appendChild(badges);
  }

  header.appendChild(second);
  container.appendChild(header);
}

/** Render the definitions panel: always visible, checkbox per-definition. */
export function renderDefinitions(
  container: HTMLElement,
  result: LookupResult,
  selection: DefinitionSelection,
  onToggle: (id: string, selected: boolean) => void,
): void {
  const panel = document.createElement('div');
  panel.className = 'cell-def js-cell-definitions';

  if (result.definitions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cell-def__empty';
    empty.textContent = 'No definitions found. Import a dictionary in Resources.';
    panel.appendChild(empty);
    container.appendChild(panel);
    return;
  }

  for (const def of result.definitions) {
    const item = document.createElement('div');
    item.className = 'cell-def__item js-cell-definition';
    item.setAttribute('data-cell-def-id', def.id);

    // Checkbox gutter — dot by default, checkbox on hover or when checked.
    const isChecked = selection.get(def.id) ?? def.defaultSelected;
    const checkLabel = document.createElement('label');
    checkLabel.className = 'cell-def__check js-cell-def-check' + (isChecked ? ' cell-def__check--checked' : '');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isChecked;
    checkbox.className = 'cell-def__check-input js-cell-def-checkbox';
    checkbox.addEventListener('change', () => {
      onToggle(def.id, checkbox.checked);
      checkLabel.classList.toggle('cell-def__check--checked', checkbox.checked);
    });
    checkLabel.appendChild(checkbox);
    const dot = document.createElement('span');
    dot.className = 'cell-def__check-dot';
    checkLabel.appendChild(dot);
    const box = document.createElement('span');
    box.className = 'cell-def__check-box';
    const tick = document.createElement('span');
    tick.className = 'cell-def__check-tick';
    tick.innerHTML = ICON_CATALOG.check.svg;
    box.appendChild(tick);
    checkLabel.appendChild(box);
    item.appendChild(checkLabel);

    const textWrap = document.createElement('div');
    textWrap.className = 'cell-def__text';

    // Combined text: "{pos} {text}" — no separate POS styling, no bullet.
    const fullText = def.pos ? `${def.pos} ${def.text}` : def.text;
    const text = document.createElement('span');
    text.textContent = fullText;
    textWrap.appendChild(text);

    if (def.examples.length > 0) {
      const examples = document.createElement('div');
      examples.className = 'cell-def__examples';
      for (const ex of def.examples) {
        const exEl = document.createElement('div');
        exEl.textContent = `• ${ex}`;
        examples.appendChild(exEl);
      }
      textWrap.appendChild(examples);
    }

    item.appendChild(textWrap);
    panel.appendChild(item);
  }

  container.appendChild(panel);
}

/** Render the active entry: header + toolbar slot + definitions, wrapped as a flex column.
 *  Sets data-cell-candidate-idx so the controller can locate per-candidate slots. */
export function renderActiveEntry(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  selection: DefinitionSelection,
  callbacks: PopupContentCallbacks,
  candidateIdx = 0,
): HTMLElement {
  const entry = document.createElement('div');
  entry.className = 'cell-active-entry js-cell-active-entry';
  entry.setAttribute('data-cell-candidate-idx', String(candidateIdx));
  renderHeader(
    entry,
    result,
    currentStatus,
    callbacks.onStatusCycle,
    callbacks.onQuickAdd,
    callbacks.onSendToCreator,
    callbacks.onSettings,
    callbacks.onClose,
    callbacks.onPlayTerm,
    callbacks.onPlaySentence,
  );
  getOrCreateMaterialsSlot(entry);
  renderDefinitions(entry, result, selection, callbacks.onDefinitionToggle);
  container.appendChild(entry);
  return entry;
}

/** Render the footer — now empty (Send to Card + Settings moved to header).
 *  Kept as a no-op for backward compatibility with callers that expect it. */
export function renderFooter(
  _container: HTMLElement,
  _onSendToCreator: () => void,
  _onSettings: () => void,
): void {
  // No-op: Send to Card and Settings are now in the header.
}

/** Candidate info for chips + list rendering. */
export interface CandidateInfo {
  readonly idx: number;
  readonly result: LookupResult;
  readonly status: WordStatus;
}

/** Render candidate chips row (spec redesign v3).
 *  Chips scroll-x in a single horizontal container; no expand/list. */
export function renderCandidateChips(
  container: HTMLElement,
  candidates: readonly CandidateInfo[],
  activeIdx: number,
  onChipClick: (idx: number) => void,
): void {
  const chips = document.createElement('div');
  chips.className = 'cell-candidates__chips js-cell-candidate-chips';

  // Scroll container for chips
  const scroll = document.createElement('div');
  scroll.className = 'cell-candidates__chips-scroll';

  for (const c of candidates) {
    const chip = document.createElement('button');
    chip.className = 'btn ' + (c.idx === activeIdx ? 'btn--primary ' : 'btn--outline ') + 'cell-chip js-cell-chip';
    chip.setAttribute('data-cell-candidate-idx', String(c.idx));
    chip.title = c.result.term;
    if (c.idx === activeIdx) {
      chip.setAttribute('aria-current', 'true');
    }
    chip.textContent = c.result.term;
    chip.addEventListener('click', () => onChipClick(c.idx));
    scroll.appendChild(chip);
  }

  chips.appendChild(scroll);
  container.appendChild(chips);
}

/** Initialize definition selection from LookupResult (default all selected). */
export function initDefinitionSelection(result: LookupResult): DefinitionSelection {
  const map = new Map<string, boolean>();
  for (const def of result.definitions) {
    map.set(def.id, def.defaultSelected);
  }
  return map;
}

/** Get the selected definitions from a selection map. */
export function getSelectedDefinitions(
  result: LookupResult,
  selection: DefinitionSelection,
): DefinitionEntry[] {
  return result.definitions.filter((def) => selection.get(def.id) ?? def.defaultSelected);
}

/** Clear all children of a container. */
export function clearContainer(container: HTMLElement): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

/** Get or create the materials slot (toolbar goes here — inside active entry, between header and definitions). */
export function getOrCreateMaterialsSlot(container: HTMLElement): HTMLElement {
  let slot = container.querySelector<HTMLElement>('.js-cell-materials-slot');
  if (!slot) {
    slot = document.createElement('div');
    slot.className = 'cell-materials js-cell-materials-slot';
    container.appendChild(slot);
  }
  return slot;
}

/** Get or create the candidates container (chips + list). */
export function getOrCreateCandidatesContainer(container: HTMLElement): HTMLElement {
  let c = container.querySelector<HTMLElement>('.js-cell-candidates');
  if (!c) {
    c = document.createElement('div');
    c.className = 'cell-candidates js-cell-candidates';
    container.appendChild(c);
  }
  return c;
}

/** Render the full popup content (active entry + candidates + footer).
 *  Spec redesign: materials slot now lives inside active entry (between header and definitions). */
export function renderPopupContent(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  selection: DefinitionSelection,
  callbacks: PopupContentCallbacks,
): void {
  // Fade the content out, swap it, then fade back in for a smooth data change.
  container.style.opacity = '0';
  clearContainer(container);
  // Active entry (header + toolbar slot + definitions)
  renderActiveEntry(container, result, currentStatus, selection, callbacks);
  // Footer — Send + Settings (status moved to header row 2)
  renderFooter(container, callbacks.onSendToCreator, callbacks.onSettings);
  // Candidates container — scrollable pills injected by controller, below footer
  getOrCreateCandidatesContainer(container);
  requestAnimationFrame(() => { container.style.opacity = '1'; });
}
