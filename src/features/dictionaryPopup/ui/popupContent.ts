// popupContent — renders header + definitions + footer into the popup shell.
//
// Spec §4.6.3 A4/A9, §9: header (term + reading + frequency + status badge),
// definitions (always visible, checkbox per-definition, default all selected),
// footer (status cycle dropdown + Quick Add button).
//
// Content-script isolated world — vanilla DOM rendered into Shadow DOM.

import type { LookupResult, DefinitionEntry, WordStatus } from '../types';
import { STATUS_CYCLE } from '../services/wordStatusStore';
import { settingsIcon, pencilIcon, zapIcon } from '@/shared/icons';

// Checkmark icon for "known" status badge (success variant).
// Lucide style: stroke 2.0, 24×24, currentColor, round caps.
const CHECK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M20 6 9 17l-5-5"/></svg>`;

// Tick for definition checkbox — white on primary fill when checked.
const CHECK_TICK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;display:block"><path d="M20 6 9 17l-5-5"/></svg>`;

// Design system §9 Badge — variant CSS per WordStatus.
// All variants: radius full (pill), font 12px semibold, flat (no shadow).
type BadgeVariant = 'neutral' | 'primary' | 'success' | 'secondary';
const STATUS_BADGE_VARIANT: Record<WordStatus, BadgeVariant> = {
  unknown: 'neutral',
  tracking: 'primary',
  known: 'success',
  ignore: 'secondary',
};
const STATUS_BADGE_CSS: Record<BadgeVariant, string> = {
  // neutral: subtle fill + secondary text (default/unknown state)
  neutral: 'display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:var(--radius-full,9999px);border:none;background:var(--color-surface-hover,#f1f5f9);color:var(--color-text-muted,#64748b);cursor:pointer;text-transform:capitalize;line-height:1;',
  // primary: solid primary fill + inverse text (tracking state)
  primary: 'display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:var(--radius-full,9999px);border:none;background:var(--color-primary,#3b82f6);color:var(--color-text-inverse,#ffffff);cursor:pointer;text-transform:capitalize;line-height:1;',
  // success: solid success fill + inverse text + checkmark (known state)
  success: 'display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:var(--radius-full,9999px);border:none;background:var(--color-success,#059669);color:var(--color-text-inverse,#ffffff);cursor:pointer;text-transform:capitalize;line-height:1;',
  // secondary: secondary fill + secondary foreground (ignore state)
  secondary: 'display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:var(--radius-full,9999px);border:none;background:var(--color-secondary,#e2e8f0);color:var(--color-secondary-foreground,#0f172a);cursor:pointer;text-transform:capitalize;line-height:1;',
};

/** Generate a stable ID for a sense within a definition. */
export function makeSenseId(definitionId: string, senseIndex: number): string {
  return `${definitionId}::sense::${senseIndex}`;
}

/**
 * Parse a sense ID back to definition ID + index.
 * Returns null for legacy definition IDs (no sense marker).
 */
export function parseSenseId(senseId: string): { definitionId: string; index: number } | null {
  const match = senseId.match(/^(.*)::sense::(\d+)$/);
  if (!match) return null;
  return { definitionId: match[1]!, index: Number(match[2]) };
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

/** Render the popup header: 3-row layout.
 *  Row 1: term (left) + Quick Add button (right)
 *  Row 2: reading / IPA
 *  Row 3: status badge (left) + frequency (right)
 */
export function renderHeader(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  onStatusCycle: () => void,
  onQuickAdd: () => void,
  onSendToCreator: () => void,
  onSettings: () => void,
): void {
  const header = document.createElement('div');
  header.setAttribute('data-dp-header', '');
  // Sticky header: dính ở top của scroll container (contentEl) khi scroll.
  // -webkit-sticky cho iOS Safari < 13, sticky cho mọi browser hiện đại.
  // background cần thiết để header không trong suốt khi content cuộn phía dưới.
  header.style.cssText = 'padding:8px 12px;border-bottom:1px solid var(--color-border,#e2e8f0);display:flex;flex-direction:column;gap:4px;position:-webkit-sticky;position:sticky;top:0;z-index:10;background:var(--color-background,#ffffff);';

  // Row 1: term + reading (left, stacked) + action buttons (right)
  const row1 = document.createElement('div');
  row1.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';

  // Term + reading group (reading on top, term below — centered on main axis)
  const termGroup = document.createElement('div');
  termGroup.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;';

  if (result.reading) {
    const reading = document.createElement('span');
    reading.setAttribute('data-dp-reading', '');
    reading.textContent = result.reading;
    reading.style.cssText = 'font-size:13px;color:var(--color-text-muted,#64748b);';
    termGroup.appendChild(reading);
  }

  const term = document.createElement('span');
  term.setAttribute('data-dp-term', '');
  term.textContent = result.term;
  term.style.cssText = 'font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  termGroup.appendChild(term);
  row1.appendChild(termGroup);

  // Action button group: Settings (gear) | Send to Card (pencil) | Quick Add (zap)
  // Uses dp-icon-btn classes from popupShell Shadow DOM (design-system.md §2 Icon Button).
  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = 'display:flex;align-items:center;gap:0;flex-shrink:0;';

  // Settings button — standard variant (no border, no bg, surface-hover fill).
  const settingsBtn = document.createElement('button');
  settingsBtn.setAttribute('data-dp-settings', '');
  settingsBtn.setAttribute('aria-label', 'Popup dictionary settings');
  settingsBtn.title = 'Settings';
  settingsBtn.className = 'icon-btn icon-btn--sm';
  settingsBtn.innerHTML = settingsIcon;
  settingsBtn.addEventListener('click', onSettings);
  btnGroup.appendChild(settingsBtn);

  // Send to Card button — standard variant.
  const sendBtn = document.createElement('button');
  sendBtn.setAttribute('data-dp-send-to-creator', '');
  sendBtn.setAttribute('aria-label', 'Send to Card Creator');
  sendBtn.title = 'Send to Card Creator';
  sendBtn.className = 'icon-btn icon-btn--sm';
  sendBtn.innerHTML = pencilIcon;
  sendBtn.addEventListener('click', onSendToCreator);
  btnGroup.appendChild(sendBtn);

  // Quick Add button — filled variant (primary bg, text-inverse color).
  const quickAdd = document.createElement('button');
  quickAdd.setAttribute('data-dp-quick-add', '');
  quickAdd.setAttribute('aria-label', 'Quick Add to Anki');
  quickAdd.title = 'Quick Add to Anki';
  quickAdd.className = 'icon-btn icon-btn--sm icon-btn--filled';
  quickAdd.innerHTML = zapIcon;
  quickAdd.addEventListener('click', onQuickAdd);
  btnGroup.appendChild(quickAdd);

  row1.appendChild(btnGroup);
  header.appendChild(row1);

  // Row 3: status badge (left) + frequency badge (left)
  // Design system §9 Badge: radius full, variant by status.
  const row3 = document.createElement('div');
  row3.style.cssText = 'display:flex;align-items:center;gap:8px;';

  // Status badge — pill, variant maps WordStatus → DS badge variant.
  // unknown=neutral, tracking=primary, known=success(+checkmark), ignore=secondary.
  const statusVariant = STATUS_BADGE_VARIANT[currentStatus] ?? 'neutral';
  const statusBadge = document.createElement('button');
  statusBadge.setAttribute('data-dp-status', '');
  statusBadge.setAttribute('data-dp-status-variant', statusVariant);
  statusBadge.style.cssText = STATUS_BADGE_CSS[statusVariant];
  statusBadge.title = 'Click to cycle status';
  statusBadge.addEventListener('click', onStatusCycle);
  // Checkmark icon for "known" status (success variant).
  if (currentStatus === 'known') {
    statusBadge.innerHTML = `${CHECK_ICON_SVG}<span>${currentStatus}</span>`;
  } else {
    statusBadge.textContent = currentStatus;
  }
  row3.appendChild(statusBadge);

  // Frequency badge — 2-segment pill: source (primary) + rank (primary-subtle).
  if (result.frequency) {
    const freq = document.createElement('span');
    freq.setAttribute('data-dp-frequency', '');
    freq.style.cssText = 'display:inline-flex;align-items:center;border-radius:var(--radius-full,9999px);overflow:hidden;font-size:12px;font-weight:600;line-height:1;';
    const src = document.createElement('span');
    src.style.cssText = 'padding:4px 10px;background:var(--color-primary,#3b82f6);color:var(--color-text-inverse,#ffffff);';
    src.textContent = result.frequency.source;
    const rank = document.createElement('span');
    rank.style.cssText = 'padding:4px 10px;background:var(--color-primary-subtle,rgba(59,130,246,0.1));color:var(--color-primary,#3b82f6);';
    rank.textContent = result.frequency.rank.toLocaleString();
    freq.appendChild(src);
    freq.appendChild(rank);
    row3.appendChild(freq);
  }

  header.appendChild(row3);
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
  panel.setAttribute('data-dp-definitions', '');
  panel.style.cssText = 'padding:8px 12px;overflow-y:auto;flex:1;min-height:0;';

  if (result.definitions.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--color-text-muted,#64748b);font-style:italic;padding:12px 0;';
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
      item.setAttribute('data-dp-definition', itemId);
      item.className = 'def-item';
      // design-system.md list-item: hover=surface-hover fill, radius=lg(10px)
      item.style.cssText = 'position:relative;border-bottom:1px solid var(--color-border,#e2e8f0);border-radius:var(--radius-lg,10px);';
      item.addEventListener('mouseenter', () => { item.style.background = 'var(--color-surface-hover, rgba(0,0,0,0.04))'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });

      // Checkbox gutter — dot by default, checkbox on hover or when checked.
      // <label> wraps the visually-hidden input + visual indicators so clicking
      // the gutter toggles. Text area is a sibling outside the label.
      const isChecked = selection.get(itemId) ?? def.defaultSelected;
      const checkLabel = document.createElement('label');
      checkLabel.className = 'def-check' + (isChecked ? ' def-check--checked' : '');
      // Dot indicator (default visible)
      const dot = document.createElement('span');
      dot.className = 'def-check__dot';
      checkLabel.appendChild(dot);
      // Checkbox visual (hidden by default, shown on hover or when checked)
      const box = document.createElement('span');
      box.className = 'def-check__box';
      const tick = document.createElement('span');
      tick.className = 'def-check__tick';
      tick.innerHTML = CHECK_TICK_SVG;
      box.appendChild(tick);
      checkLabel.appendChild(box);
      // Visually hidden input — still functional via label click
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isChecked;
      checkbox.setAttribute('data-dp-def-checkbox', itemId);
      checkbox.className = 'def-check__input';
      checkbox.addEventListener('change', () => {
        onToggle(itemId, checkbox.checked);
        // Update visual state — toggle is-checked class on label
        checkLabel.classList.toggle('is-checked', checkbox.checked);
      });
      checkLabel.appendChild(checkbox);
      item.appendChild(checkLabel);

      // Definition text — padding-left makes room for the absolute gutter.
      const textWrap = document.createElement('div');
      textWrap.style.cssText = 'padding:8px 0 8px 34px;';

      // Show POS only on the first sense; subsequent senses share the same POS.
      if (i === 0 && def.pos) {
        const pos = document.createElement('span');
        pos.setAttribute('data-dp-pos', '');
        pos.textContent = `${def.pos}. `;
        pos.style.cssText = 'font-style:italic;color:var(--color-text-muted,#64748b);';
        textWrap.appendChild(pos);
      }

      const text = document.createElement('span');
      text.textContent = senses[i];
      textWrap.appendChild(text);

      // Examples attach to the first sense only (we don't know which sense each example belongs to).
      if (i === 0 && def.examples.length > 0) {
        const examples = document.createElement('div');
        examples.style.cssText = 'margin-top:4px;font-size:12px;color:var(--color-text-muted,#64748b);';
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

/** Render the footer: status cycle + Quick Add button. */
export function renderFooter(
  container: HTMLElement,
  currentStatus: WordStatus,
  onStatusCycle: () => void,
  onQuickAdd: () => void,
): void {
  const footer = document.createElement('div');
  footer.setAttribute('data-dp-footer', '');
  footer.style.cssText = 'padding:8px 12px;border-top:1px solid var(--color-border,#e2e8f0);display:flex;align-items:center;justify-content:space-between;gap:8px;';

  // Status cycle button (left)
  const statusBtn = document.createElement('button');
  statusBtn.setAttribute('data-dp-footer-status', '');
  statusBtn.textContent = currentStatus;
  statusBtn.style.cssText = 'font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid var(--color-border,#cbd5e1);background:transparent;cursor:pointer;text-transform:capitalize;';
  statusBtn.title = `Cycle: ${STATUS_CYCLE.join(' → ')}`;
  statusBtn.addEventListener('click', onStatusCycle);
  footer.appendChild(statusBtn);

  // Quick Add button (right) — design-system.md §1 Button (pill, primary)
  const quickAdd = document.createElement('button');
  quickAdd.setAttribute('data-dp-quick-add', '');
  quickAdd.setAttribute('aria-label', 'Quick Add to Anki');
  quickAdd.title = 'Quick Add to Anki';
  quickAdd.textContent = 'Quick Add';
  quickAdd.style.cssText = 'font-size:14px;font-weight:500;padding:8px 16px;border-radius:18px;border:none;background:var(--color-primary);color:var(--color-text-inverse,#ffffff);cursor:pointer;transition:background 0.15s ease;';
  quickAdd.addEventListener('click', onQuickAdd);
  footer.appendChild(quickAdd);

  container.appendChild(footer);
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

    // If all senses selected, keep the original definition entry (less duplication).
    if (selectedIndexes.length === senses.length) {
      selected.push(def);
      continue;
    }

    // Otherwise, create a separate DefinitionEntry for each selected sense.
    for (const idx of selectedIndexes) {
      selected.push({
        ...def,
        id: makeSenseId(def.id, idx),
        text: senses[idx]!,
        // Attach examples to the first selected sense as a reasonable default.
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

/** Get or create the candidate-list wrapper (display:block) inside a container.
 *  iOS Safari has a known bug with position:sticky inside flex containers —
 *  wrapping candidates in a block-level div avoids it. */
export function getOrCreateCandidateList(container: HTMLElement): HTMLElement {
  let list = container.querySelector<HTMLElement>('[data-dp-candidate-list]');
  if (!list) {
    list = document.createElement('div');
    list.setAttribute('data-dp-candidate-list', '');
    list.style.cssText = 'display:block;';
    container.appendChild(list);
  }
  return list;
}

/** Render the full popup content (header + definitions + footer). */
export function renderPopupContent(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  selection: DefinitionSelection,
  callbacks: {
    onStatusCycle: () => void;
    onDefinitionToggle: (id: string, selected: boolean) => void;
    onQuickAdd: () => void;
    onSendToCreator: () => void;
    onSettings: () => void;
  },
): void {
  clearContainer(container);
  const list = getOrCreateCandidateList(container);
  renderCandidate(list, result, currentStatus, selection, callbacks);
}

/** Callbacks for a single candidate. */
export interface CandidateCallbacks {
  onStatusCycle: () => void;
  onDefinitionToggle: (id: string, selected: boolean) => void;
  onQuickAdd: () => void;
  onSendToCreator: () => void;
  onSettings: () => void;
}

/**
 * Render a single candidate (header + definitions) into a wrapper div with
 * data-dp-popup-candidate attribute. Used for both the first candidate
 * (winner) and appended candidates.
 */
export function renderCandidate(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  selection: DefinitionSelection,
  callbacks: CandidateCallbacks,
): HTMLElement {
  const candidate = document.createElement('div');
  candidate.setAttribute('data-dp-popup-candidate', '');
  renderHeader(candidate, result, currentStatus, callbacks.onStatusCycle, callbacks.onQuickAdd, callbacks.onSendToCreator, callbacks.onSettings);
  // Toolbar slot — filled by appendCandidate (per-candidate tab state).
  const toolbarSlot = document.createElement('div');
  toolbarSlot.setAttribute('data-dp-toolbar-slot', '');
  candidate.appendChild(toolbarSlot);
  renderDefinitions(candidate, result, selection, callbacks.onDefinitionToggle);
  container.appendChild(candidate);
  return candidate;
}

/**
 * Append a candidate to an existing popup container.
 * Used for progressive rendering of additional phrase match candidates.
 */
export function appendCandidateContent(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  selection: DefinitionSelection,
  callbacks: CandidateCallbacks,
): HTMLElement {
  const list = getOrCreateCandidateList(container);
  return renderCandidate(list, result, currentStatus, selection, callbacks);
}
