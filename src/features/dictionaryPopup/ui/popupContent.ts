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
  header.style.cssText = 'padding:8px 12px;border-bottom:1px solid var(--dp-border,#e2e8f0);display:flex;flex-direction:column;gap:4px;';

  // Row 1: term (left) + action buttons (right)
  const row1 = document.createElement('div');
  row1.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';

  const term = document.createElement('span');
  term.setAttribute('data-dp-term', '');
  term.textContent = result.term;
  term.style.cssText = 'font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  row1.appendChild(term);

  // Action button group: Settings (gear) | Send to Card (paper plane) | Quick Add (plus)
  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = 'display:flex;align-items:center;gap:4px;flex-shrink:0;';

  // Shared icon button style: 16px SVG, 28px clickable button.
  const iconBtnStyle = 'display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;border:1px solid var(--dp-border,#cbd5e1);background:transparent;cursor:pointer;padding:0;color:var(--dp-text,#1e293b);';
  const iconBtnPrimaryStyle = 'display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;border:none;background:var(--dp-primary,#3b82f6);color:white;cursor:pointer;padding:0;';
  const svgStyle = 'width:16px;height:16px;flex-shrink:0;';

  // Settings button — opens popup dictionary settings.
  const settingsBtn = document.createElement('button');
  settingsBtn.setAttribute('data-dp-settings', '');
  settingsBtn.title = 'Popup dictionary settings';
  settingsBtn.style.cssText = iconBtnStyle;
  settingsBtn.innerHTML = settingsIcon.replace('<svg', `<svg style="${svgStyle}"`);
  settingsBtn.addEventListener('click', onSettings);
  btnGroup.appendChild(settingsBtn);

  // Send to Card button — opens Card Creator pre-filled with lookup result.
  const sendBtn = document.createElement('button');
  sendBtn.setAttribute('data-dp-send-to-creator', '');
  sendBtn.title = 'Send to Card Creator';
  sendBtn.style.cssText = iconBtnStyle;
  sendBtn.innerHTML = pencilIcon.replace('<svg', `<svg style="${svgStyle}"`);
  sendBtn.addEventListener('click', onSendToCreator);
  btnGroup.appendChild(sendBtn);

  // Quick Add button — add directly to SRS (Anki).
  const quickAdd = document.createElement('button');
  quickAdd.setAttribute('data-dp-quick-add', '');
  quickAdd.title = 'Quick Add to Anki';
  quickAdd.style.cssText = iconBtnPrimaryStyle;
  quickAdd.innerHTML = zapIcon.replace('<svg', `<svg style="${svgStyle}"`);
  quickAdd.addEventListener('click', onQuickAdd);
  btnGroup.appendChild(quickAdd);

  row1.appendChild(btnGroup);
  header.appendChild(row1);

  // Row 2: reading / IPA
  if (result.reading) {
    const reading = document.createElement('div');
    reading.setAttribute('data-dp-reading', '');
    reading.textContent = result.reading;
    reading.style.cssText = 'font-size:13px;color:var(--dp-muted,#64748b);';
    header.appendChild(reading);
  }

  // Row 3: status (left) + frequency (left)
  const row3 = document.createElement('div');
  row3.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const statusBadge = document.createElement('button');
  statusBadge.setAttribute('data-dp-status', '');
  statusBadge.textContent = currentStatus;
  statusBadge.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--dp-border,#cbd5e1);background:transparent;cursor:pointer;text-transform:capitalize;';
  statusBadge.title = 'Click to cycle status';
  statusBadge.addEventListener('click', onStatusCycle);
  row3.appendChild(statusBadge);

  if (result.frequency) {
    const freq = document.createElement('span');
    freq.setAttribute('data-dp-frequency', '');
    freq.textContent = `#${result.frequency.rank}`;
    freq.style.cssText = 'font-size:11px;padding:2px 6px;border-radius:4px;background:var(--dp-badge-bg,#f1f5f9);color:var(--dp-muted,#64748b);';
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
    empty.style.cssText = 'color:var(--dp-muted,#64748b);font-style:italic;padding:12px 0;';
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
      item.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--dp-border,#e2e8f0);';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:6px;';

      // Checkbox — one per sense, so users can pick individual meanings.
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selection.get(itemId) ?? def.defaultSelected;
      checkbox.setAttribute('data-dp-def-checkbox', itemId);
      checkbox.style.cssText = 'margin-top:3px;flex-shrink:0;';
      checkbox.addEventListener('change', () => {
        onToggle(itemId, checkbox.checked);
      });
      row.appendChild(checkbox);

      // Definition text
      const textWrap = document.createElement('div');
      textWrap.style.cssText = 'flex:1;min-width:0;';

      // Show POS only on the first sense; subsequent senses share the same POS.
      if (i === 0 && def.pos) {
        const pos = document.createElement('span');
        pos.setAttribute('data-dp-pos', '');
        pos.textContent = `${def.pos}. `;
        pos.style.cssText = 'font-style:italic;color:var(--dp-muted,#64748b);';
        textWrap.appendChild(pos);
      }

      const text = document.createElement('span');
      text.textContent = senses[i];
      textWrap.appendChild(text);

      // Examples attach to the first sense only (we don't know which sense each example belongs to).
      if (i === 0 && def.examples.length > 0) {
        const examples = document.createElement('div');
        examples.style.cssText = 'margin-top:4px;font-size:12px;color:var(--dp-muted,#64748b);';
        for (const ex of def.examples) {
          const exEl = document.createElement('div');
          exEl.textContent = `• ${ex}`;
          examples.appendChild(exEl);
        }
        textWrap.appendChild(examples);
      }

      row.appendChild(textWrap);
      item.appendChild(row);
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
  footer.style.cssText = 'padding:8px 12px;border-top:1px solid var(--dp-border,#e2e8f0);display:flex;align-items:center;justify-content:space-between;gap:8px;';

  // Status cycle button (left)
  const statusBtn = document.createElement('button');
  statusBtn.setAttribute('data-dp-footer-status', '');
  statusBtn.textContent = currentStatus;
  statusBtn.style.cssText = 'font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid var(--dp-border,#cbd5e1);background:transparent;cursor:pointer;text-transform:capitalize;';
  statusBtn.title = `Cycle: ${STATUS_CYCLE.join(' → ')}`;
  statusBtn.addEventListener('click', onStatusCycle);
  footer.appendChild(statusBtn);

  // Quick Add button (right)
  const quickAdd = document.createElement('button');
  quickAdd.setAttribute('data-dp-quick-add', '');
  quickAdd.textContent = '+ Quick Add';
  quickAdd.style.cssText = 'font-size:13px;padding:4px 12px;border-radius:6px;border:none;background:var(--dp-primary,#3b82f6);color:white;cursor:pointer;font-weight:500;';
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
  renderHeader(container, result, currentStatus, callbacks.onStatusCycle, callbacks.onQuickAdd, callbacks.onSendToCreator, callbacks.onSettings);
  renderDefinitions(container, result, selection, callbacks.onDefinitionToggle);
}
