/**
 * Subtitle offset section — DOM factory (ADR-019 V3).
 *
 * V3 (2026-07-05): value cell ở giữa pill là <input> editable (click → edit).
 * Bỏ input row top. Reset chuyển xuống dưới (full-width pill).
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │ OFFSET                                  │
 *   ├─────────────────────────────────────────┤
 *   │  ╭───────────────────────────────────╮  │  ← PILL (4 step + value-input)
 *   │  │ −2s │ −0.5s │  +0.50s  │ +0.5s │ +2s │  │     value = <input> editable
 *   │  ╰───────────────────────────────────╯  │
 *   │  ╭───────────────────────────────────╮  │  ← RESET (bottom, full-width)
 *   │  │      ↺  Đặt lại về 0              │  │
 *   │  ╰───────────────────────────────────╯  │
 *   └─────────────────────────────────────────┘
 *
 * CSS bleed fix (V3): focus ring inset (không tràn ra step buttons),
 * divider bằng ::before pseudo-element (không shift), z-index layering,
 * pill isolation: isolate (stacking context riêng).
 *
 * Section collapsible nested trong Subtitle Manager Panel.
 * Inversion of control: nhận handlers callback, không biết OffsetController logic.
 */

import { ICON_CATALOG } from '@/shared/icons';

/** Section API — returned by createOffsetSection. */
export interface OffsetSectionApi {
  readonly section: HTMLDivElement;
  readonly header: HTMLButtonElement;
  readonly body: HTMLDivElement;
  /** Update UI theo valueMs + hasSubtitle flag. */
  update(valueMs: number, hasSubtitle: boolean): void;
  /** Destroy — remove section from DOM, cleanup listeners. */
  destroy(): void;
}

/** Handlers — caller (OffsetController) provide these. */
export interface OffsetPanelHandlers {
  /** Stepper button clicked. deltaMs = ±500 or ±2000. */
  onStep: (deltaMs: number) => void;
  /** Input submitted (already parsed to ms). null = invalid input. */
  onInput: (valueMs: number | null) => void;
  /** Reset button clicked. */
  onReset: () => void;
}

// SVG path data from ICON_CATALOG. Sizing (12px / 14px) + display style injected per-use.
const CHEVRON_SVG = ICON_CATALOG.chevronDown.svg.replace('<svg ', '<svg width="12" height="12" focusable="false" style="display:block;fill:none !important" ');
const RESET_SVG = ICON_CATALOG.resetOffset.svg.replace('<svg ', '<svg width="14" height="14" focusable="false" style="display:block;fill:none !important" ');

/**
 * Create offset section — DOM factory pattern. Nested trong Subtitle Manager Panel.
 *
 * @param parentPanel - Manager panel element (section appended here)
 * @param handlers - Callbacks for step/input/reset
 * @returns Section API
 */
export function createOffsetSection(
  parentPanel: HTMLElement,
  handlers: OffsetPanelHandlers,
): OffsetSectionApi {
  // === Section root ===
  const section = document.createElement('div');
  section.setAttribute('data-testid', 'offset-section');
  section.setAttribute('data-role', 'offset');
  parentPanel.appendChild(section);

  // === Header (collapsible) ===
  const header = document.createElement('button');
  header.setAttribute('type', 'button');
  header.setAttribute('data-testid', 'offset-section-header');
  header.setAttribute('aria-expanded', 'true');
  header.setAttribute('aria-label', 'Toggle Offset section');
  header.setAttribute('title', 'Toggle Offset section');
  header.className = 'offset-header';

  const chevron = document.createElement('span');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = CHEVRON_SVG;
  chevron.className = 'offset-header-chevron';
  header.appendChild(chevron);

  const labelEl = document.createElement('span');
  labelEl.textContent = 'OFFSET';
  labelEl.className = 'offset-header-label';
  header.appendChild(labelEl);

  section.appendChild(header);

  // === Body ===
  const body = document.createElement('div');
  body.setAttribute('data-testid', 'offset-section-body');
  body.className = 'offset-body';
  section.appendChild(body);

  // === Pill — 5 ô: [−2s][−0.5s][VALUE-input][+0.5s][+2s] ===
  // Value ở giữa là <input> editable. Reset tách ra bottom (full-width).
  // CSS bleed fix: isolation: isolate + z-index layering + inset focus ring.
  const pill = document.createElement('div');
  pill.setAttribute('data-testid', 'offset-pill');
  pill.setAttribute('role', 'group');
  pill.setAttribute('aria-label', 'Subtitle offset control');
  pill.className = 'offset-pill';
  body.appendChild(pill);

  // --- Build step button factory (lắp theo thứ tự: −2s, −0.5s, VALUE, +0.5s, +2s) ---
  const stepBtns: HTMLButtonElement[] = [];
  const createStepBtn = (delta: number): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-testid', `offset-step-${delta}`);
    const isPlus = delta > 0;
    btn.setAttribute('aria-label', isPlus ? `Tiến ${delta / 1000} giây` : `Lùi ${Math.abs(delta) / 1000} giây`);
    btn.className = `offset-step-btn ${isPlus ? 'offset-step-btn--plus' : 'offset-step-btn--minus'}`;
    btn.textContent = `${isPlus ? '+' : '−'}${Math.abs(delta) / 1000}s`;
    btn.addEventListener('click', () => handlers.onStep(delta));
    return btn;
  };

  // --- Value INPUT (ô giữa, editable, to + đậm + bg primary-subtle) ---
  // V3: value là <input type="text"> — click → select all → gõ số giây → Enter commit.
  // CSS bleed fix: border-radius sm (không full), focus = inset ring (không tràn).
  const valueInput = document.createElement('input');
  valueInput.setAttribute('type', 'text');
  valueInput.setAttribute('data-testid', 'offset-value');
  valueInput.setAttribute('role', 'status');
  valueInput.setAttribute('aria-label', 'Current offset (nhập số giây)');
  valueInput.setAttribute('inputmode', 'decimal');
  valueInput.value = '0s';
  valueInput.className = 'offset-value offset-value--zero';

  // --- Lắp vào pill theo thứ tự: −2s, −0.5s, VALUE, +0.5s, +2s ---
  const minus2 = createStepBtn(-2000);
  const minusHalf = createStepBtn(-500);
  const plusHalf = createStepBtn(500);
  const plus2 = createStepBtn(2000);
  pill.appendChild(minus2);
  pill.appendChild(minusHalf);
  pill.appendChild(valueInput);
  pill.appendChild(plusHalf);
  pill.appendChild(plus2);
  stepBtns.push(minus2, minusHalf, plusHalf, plus2);

  // Value input: focus → select all. Enter/blur → parse + commit. Esc → revert.
  // Focus styling handled by CSS :focus rule on .offset-value.
  valueInput.addEventListener('focus', () => {
    valueInput.select();
  });
  const commitValueInput = (): void => {
    const parsed = parseOffsetInputSafe(valueInput.value);
    if (parsed !== null) {
      handlers.onInput(parsed);
      // Force display format after commit — update() may have skipped
      // setting value because input was still focused at commit time.
      valueInput.value = formatOffsetValue(parsed);
    } else {
      // Invalid → revert to current valueMs
      valueInput.value = formatOffsetValue(currentValueMs);
    }
  };
  valueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValueInput();
      valueInput.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      valueInput.value = formatOffsetValue(currentValueMs);
      valueInput.blur();
    }
  });
  valueInput.addEventListener('blur', commitValueInput);

  // --- Reset button (BOTTOM, full-width pill) ---
  const resetBtn = document.createElement('button');
  resetBtn.setAttribute('type', 'button');
  resetBtn.setAttribute('data-testid', 'offset-reset');
  resetBtn.setAttribute('aria-label', 'Đặt lại về 0');
  resetBtn.setAttribute('title', 'Đặt lại về 0');
  resetBtn.className = 'offset-reset-btn';
  const resetIcon = document.createElement('span');
  resetIcon.innerHTML = RESET_SVG;
  resetIcon.className = 'offset-reset-icon';
  resetBtn.appendChild(resetIcon);
  const resetLabel = document.createElement('span');
  resetLabel.textContent = 'Đặt lại về 0';
  resetBtn.appendChild(resetLabel);
  resetBtn.addEventListener('click', () => handlers.onReset());
  body.appendChild(resetBtn);

  // --- Disabled hint (hidden by default) ---
  const disabledHint = document.createElement('div');
  disabledHint.setAttribute('data-testid', 'offset-disabled-hint');
  disabledHint.textContent = 'Cần load subtitle trước';
  disabledHint.className = 'offset-disabled-hint';
  body.appendChild(disabledHint);

  // === Collapse toggle ===
  let expanded = true;
  header.addEventListener('click', () => {
    expanded = !expanded;
    body.style.display = expanded ? 'block' : 'none';
    header.setAttribute('aria-expanded', String(expanded));
    chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
  });

  // === Update logic ===
  let currentValueMs = 0;
  const allControls = [resetBtn, ...stepBtns, valueInput];

  function update(valueMs: number, hasSubtitle: boolean): void {
    currentValueMs = valueMs;

    // Value input text — only update when NOT focused (so user can type freely)
    if (document.activeElement !== valueInput) {
      valueInput.value = formatOffsetValue(valueMs);
    }

    // Value color via state class: 0 = muted, + = success, - = info
    const stateClass = valueMs === 0
      ? 'offset-value--zero'
      : valueMs > 0
        ? 'offset-value--positive'
        : 'offset-value--negative';
    valueInput.className = `offset-value ${stateClass}`;

    // Disabled state
    if (!hasSubtitle) {
      allControls.forEach((c) => ((c as HTMLButtonElement | HTMLInputElement).disabled = true));
      disabledHint.className = 'offset-disabled-hint offset-disabled-hint--visible';
    } else {
      allControls.forEach((c) => ((c as HTMLButtonElement | HTMLInputElement).disabled = false));
      disabledHint.className = 'offset-disabled-hint';
    }
  }

  // === Destroy ===
  function destroy(): void {
    section.remove();
  }

  return { section, header, body, update, destroy };
}

// === Helpers ===

/** Format ms → display string for value input: 0 → "0s", 700 → "+0.7s", -500 → "−0.5s". */
function formatOffsetValue(ms: number): string {
  if (ms === 0) return '0s';
  const seconds = ms / 1000;
  const sign = ms > 0 ? '+' : '−';
  const absSeconds = Math.abs(seconds);
  const formatted = absSeconds % 1 === 0 ? String(absSeconds) : String(absSeconds);
  return `${sign}${formatted}s`;
}

/** Parse input string → ms. Accept: "0.5", "+0.5", "-0.5", "0.5s", "+0.5s". */
function parseOffsetInputSafe(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  // Strip optional "s" suffix
  const cleaned = trimmed.endsWith('s') || trimmed.endsWith('S')
    ? trimmed.slice(0, -1).trim()
    : trimmed;
  if (cleaned === '' || cleaned === '+' || cleaned === '-' || cleaned === '−') return null;
  const seconds = Number(cleaned);
  if (!Number.isFinite(seconds)) return null;
  const ms = Math.round(seconds * 1000);
  if (ms < -60_000 || ms > 60_000) return null;
  return ms;
}
