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

// Design system §9 Status badge — soft pill per WordStatus.
// BEM modifier classes: .cell-header__status--<status>
//   unknown=error, tracking=warning, known=success, ignore=neutral

/** Generate a stable ID for a sense within a definition. */
export function makeSenseId(definitionId: string, senseIndex: number): string {
  return `${definitionId}::sense::${senseIndex}`;
}

/**
 * Split a definition text that contains numbered senses into separate parts.
 * Example: "to think about... 2.to consider... 3.to read..." → 5 items.
 * If there is only one sense, returns a single-element array.
 */
export function splitNumberedSenses(text: string): string[] {
  // Split at positions followed by a digit + dot, e.g. "2.", "3.".
  // Keep the delimiters with the following sense.
  const parts = text.split(/(?=\d+\.)/).map((s) => s.trim()).filter(Boolean);
  // Guard against false positives like "1.5 kg" — only split if 2+ numeric markers exist.
  const numericMarkers = parts.filter((p) => /^\d+\./.test(p));
  return numericMarkers.length >= 2 ? parts : [text.trim()];
}

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
 *  Row 1: word + reading-row(IPA + audio-group) + actions (QuickAdd + Close)
 *  Row 2: second header (badges + status, scroll main axis if overflow)
 */
export function renderHeader(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  onStatusCycle: () => void,
  onQuickAdd: () => void,
  _onSendToCreator: () => void,
  _onSettings: () => void,
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

  // word-row: word only, truncates with ellipsis
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

  // Actions: Quick Add + Close
  const actions = document.createElement('div');
  actions.className = 'cell-header__actions';

  const quickAdd = document.createElement('button');
  quickAdd.className = 'btn btn--primary cell-header__quick-add js-cell-quick-add';
  quickAdd.setAttribute('aria-label', 'Quick Add to Anki');
  quickAdd.title = 'Quick Add to Anki';
  quickAdd.innerHTML = `${ICON_CATALOG.zap.svg}<span class="cell-header__quick-add-label cell-label">Quick Add</span>`;
  quickAdd.addEventListener('click', onQuickAdd);
  actions.appendChild(quickAdd);

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
  if (currentStatus === 'known') {
    statusBadge.innerHTML = `${ICON_CATALOG.check.svg}<span>${currentStatus}</span>`;
  } else {
    statusBadge.textContent = currentStatus;
  }
  second.appendChild(statusBadge);

  // Frequency badges (RIGHT of status)
  if (result.frequency) {
    const badges = document.createElement('div');
    badges.className = 'cell-header__badges';
    const freq = document.createElement('span');
    freq.className = 'cell-header__frequency js-cell-frequency';
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
    const senses = splitNumberedSenses(def.text);
    const isMultiSense = senses.length > 1;
    for (let i = 0; i < senses.length; i++) {
      // Single-sense definitions keep the original def.id for backward compatibility.
      // Multi-sense definitions use per-sense IDs so each meaning can be selected.
      const itemId = isMultiSense ? makeSenseId(def.id, i) : def.id;
      const item = document.createElement('div');
      item.className = 'cell-def__item js-cell-definition';
      item.setAttribute('data-cell-def-id', itemId);

      // Checkbox gutter — dot by default, checkbox on hover or when checked.
      const isChecked = selection.get(itemId) ?? def.defaultSelected;
      const checkLabel = document.createElement('label');
      checkLabel.className = 'cell-def__check js-cell-def-check' + (isChecked ? ' cell-def__check--checked' : '');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isChecked;
      checkbox.className = 'cell-def__check-input js-cell-def-checkbox';
      checkbox.addEventListener('change', () => {
        onToggle(itemId, checkbox.checked);
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

      if (i === 0 && def.pos) {
        const pos = document.createElement('span');
        pos.className = 'cell-def__pos';
        pos.textContent = `${def.pos}. `;
        textWrap.appendChild(pos);
      }

      const text = document.createElement('span');
      text.textContent = senses[i];
      textWrap.appendChild(text);

      if (i === 0 && def.examples.length > 0) {
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
  }

  container.appendChild(panel);
}

/** Render the active entry: header + toolbar slot + definitions, wrapped as a flex column. */
export function renderActiveEntry(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  selection: DefinitionSelection,
  callbacks: PopupContentCallbacks,
): HTMLElement {
  const entry = document.createElement('div');
  entry.className = 'cell-active-entry js-cell-active-entry';
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

/** Render the footer: Send to Creator + Settings (status moved to header row 2). */
export function renderFooter(
  container: HTMLElement,
  onSendToCreator: () => void,
  onSettings: () => void,
): void {
  const footer = document.createElement('div');
  footer.className = 'cell-footer js-cell-footer';

  // Actions: Send to Creator + Settings
  const actions = document.createElement('div');
  actions.className = 'cell-footer__actions';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'btn btn--outline cell-footer__send js-cell-send-to-creator';
  sendBtn.setAttribute('aria-label', 'Send to Card Creator');
  sendBtn.title = 'Send to Card Creator';
  sendBtn.innerHTML = `${ICON_CATALOG.pencil.svg}<span class="cell-footer__send-label cell-label">Send to Creator</span>`;
  sendBtn.addEventListener('click', onSendToCreator);
  actions.appendChild(sendBtn);

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'icon-btn icon-btn--sm js-cell-settings';
  settingsBtn.setAttribute('aria-label', 'Popup dictionary settings');
  settingsBtn.title = 'Settings';
  settingsBtn.innerHTML = ICON_CATALOG.settings.svg;
  settingsBtn.addEventListener('click', onSettings);
  actions.appendChild(settingsBtn);

  footer.appendChild(actions);
  container.appendChild(footer);
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
    const senses = splitNumberedSenses(def.text);
    if (senses.length <= 1) {
      map.set(def.id, def.defaultSelected);
    } else {
      for (let i = 0; i < senses.length; i++) {
        map.set(makeSenseId(def.id, i), def.defaultSelected);
      }
    }
  }
  return map;
}

/** Get the selected definitions from a selection map. */
export function getSelectedDefinitions(
  result: LookupResult,
  selection: DefinitionSelection,
): DefinitionEntry[] {
  const selected: DefinitionEntry[] = [];
  for (const def of result.definitions) {
    const senses = splitNumberedSenses(def.text);
    if (senses.length <= 1) {
      if (selection.get(def.id) ?? def.defaultSelected) {
        selected.push(def);
      }
      continue;
    }

    const selectedIndexes: number[] = [];
    for (let i = 0; i < senses.length; i++) {
      if (selection.get(makeSenseId(def.id, i)) ?? def.defaultSelected) {
        selectedIndexes.push(i);
      }
    }

    if (selectedIndexes.length === 0) continue;

    if (selectedIndexes.length === senses.length) {
      selected.push(def);
      continue;
    }

    for (const idx of selectedIndexes) {
      selected.push({
        ...def,
        id: makeSenseId(def.id, idx),
        text: senses[idx]!,
        examples: idx === 0 ? def.examples : [],
      });
    }
  }
  return selected;
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
  clearContainer(container);
  // Active entry (header + toolbar slot + definitions)
  renderActiveEntry(container, result, currentStatus, selection, callbacks);
  // Candidates container — chips injected by controller
  getOrCreateCandidatesContainer(container);
  // Footer — Send + Settings (status moved to header row 2)
  renderFooter(container, callbacks.onSendToCreator, callbacks.onSettings);
}
