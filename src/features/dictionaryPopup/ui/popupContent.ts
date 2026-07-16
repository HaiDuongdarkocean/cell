// popupContent — renders header + definitions + footer into the popup shell.
//
// Spec §4.6.3 A4/A9, §9: header (term + reading + frequency + status badge),
// definitions (always visible, checkbox per-definition, default all selected),
// footer (status cycle dropdown + Quick Add button).
//
// Content-script isolated world — vanilla DOM rendered into Shadow DOM.

import type { LookupResult, DefinitionEntry, WordStatus } from '../types';
import { STATUS_CYCLE } from '../services/wordStatusStore';

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
): void {
  const header = document.createElement('div');
  header.setAttribute('data-dp-header', '');
  header.style.cssText = 'padding:8px 12px;border-bottom:1px solid var(--dp-border,#e2e8f0);display:flex;flex-direction:column;gap:4px;';

  // Row 1: term (left) + Quick Add (right)
  const row1 = document.createElement('div');
  row1.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';

  const term = document.createElement('span');
  term.setAttribute('data-dp-term', '');
  term.textContent = result.term;
  term.style.cssText = 'font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  row1.appendChild(term);

  const quickAdd = document.createElement('button');
  quickAdd.setAttribute('data-dp-quick-add', '');
  quickAdd.textContent = '+ Quick Add';
  quickAdd.style.cssText = 'font-size:12px;padding:3px 10px;border-radius:6px;border:none;background:var(--dp-primary,#3b82f6);color:white;cursor:pointer;font-weight:500;flex-shrink:0;';
  quickAdd.addEventListener('click', onQuickAdd);
  row1.appendChild(quickAdd);

  header.appendChild(row1);

  // Row 2: reading / IPA
  if (result.reading) {
    const reading = document.createElement('div');
    reading.setAttribute('data-dp-reading', '');
    reading.textContent = result.reading;
    reading.style.cssText = 'font-size:13px;color:var(--dp-muted,#64748b);';
    header.appendChild(reading);
  }

  // Row 3: status (left) + frequency (right)
  const row3 = document.createElement('div');
  row3.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';

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
  panel.style.cssText = 'padding:8px 12px;overflow-y:auto;flex:1;';

  if (result.definitions.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--dp-muted,#64748b);font-style:italic;padding:12px 0;';
    empty.textContent = 'No definitions found. Import a dictionary in Resources.';
    panel.appendChild(empty);
    container.appendChild(panel);
    return;
  }

  for (const def of result.definitions) {
    const item = document.createElement('div');
    item.setAttribute('data-dp-definition', def.id);
    item.style.cssText = 'padding:6px 0;border-bottom:1px solid var(--dp-border,#f1f5f9);';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:6px;';

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selection.get(def.id) ?? def.defaultSelected;
    checkbox.setAttribute('data-dp-def-checkbox', def.id);
    checkbox.style.cssText = 'margin-top:3px;flex-shrink:0;';
    checkbox.addEventListener('change', () => {
      onToggle(def.id, checkbox.checked);
    });
    row.appendChild(checkbox);

    // Definition text
    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'flex:1;min-width:0;';

    if (def.pos) {
      const pos = document.createElement('span');
      pos.setAttribute('data-dp-pos', '');
      pos.textContent = `${def.pos}. `;
      pos.style.cssText = 'font-style:italic;color:var(--dp-muted,#64748b);';
      textWrap.appendChild(pos);
    }

    const text = document.createElement('span');
    text.textContent = def.text;
    textWrap.appendChild(text);

    // Examples
    if (def.examples.length > 0) {
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
    map.set(def.id, def.defaultSelected);
  }
  return map;
}

/** Get the selected definitions from a selection map. */
export function getSelectedDefinitions(
  result: LookupResult,
  selection: DefinitionSelection,
): DefinitionEntry[] {
  return result.definitions.filter((d) => selection.get(d.id) ?? d.defaultSelected);
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
  },
): void {
  clearContainer(container);
  renderHeader(container, result, currentStatus, callbacks.onStatusCycle, callbacks.onQuickAdd);
  renderDefinitions(container, result, selection, callbacks.onDefinitionToggle);
}
