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

const CHEVRON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>';
const RESET_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M18.364 8.05026L17.6569 7.34315C14.5327 4.21896 9.46734 4.21896 6.34315 7.34315C3.21895 10.4673 3.21895 15.5327 6.34315 18.6569C9.46734 21.7811 14.5327 21.7811 17.6569 18.6569C19.4737 16.84 20.234 14.3668 19.9377 12.0005M18.364 8.05026H14.1213M18.364 8.05026V3.80762" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    cursor: pointer;
    border-radius: var(--radius-sm, 6px);
    user-select: none;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    text-align: left;
    transition: background 150ms ease;
  `;

  const chevron = document.createElement('span');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = CHEVRON_SVG;
  chevron.style.cssText = 'display: inline-flex; color: var(--color-text-muted); transition: transform 150ms ease;';
  header.appendChild(chevron);

  const labelEl = document.createElement('span');
  labelEl.textContent = 'OFFSET';
  labelEl.style.cssText = `
    font-size: var(--font-size-xs, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex: 1;
    color: var(--color-text-muted);
  `;
  header.appendChild(labelEl);

  section.appendChild(header);

  // === Body ===
  const body = document.createElement('div');
  body.setAttribute('data-testid', 'offset-section-body');
  body.style.cssText = 'padding: var(--spacing-xs, 4px) var(--spacing-xs, 4px) var(--spacing-sm, 8px); display: block;';
  section.appendChild(body);

  // === Pill — 5 ô: [−2s][−0.5s][VALUE-input][+0.5s][+2s] ===
  // Value ở giữa là <input> editable. Reset tách ra bottom (full-width).
  // CSS bleed fix: isolation: isolate + z-index layering + inset focus ring.
  const pill = document.createElement('div');
  pill.setAttribute('data-testid', 'offset-pill');
  pill.setAttribute('role', 'group');
  pill.setAttribute('aria-label', 'Subtitle offset control');
  pill.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr 1.6fr 1fr 1fr;
    align-items: stretch;
    background: var(--color-surface, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-full, 9999px);
    padding: 3px;
    gap: 0;
    margin-bottom: var(--spacing-sm, 8px);
    isolation: isolate;
  `;
  body.appendChild(pill);

  // --- Build step button factory (lắp theo thứ tự: −2s, −0.5s, VALUE, +0.5s, +2s) ---
  const stepBtns: HTMLButtonElement[] = [];
  const createStepBtn = (delta: number): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-testid', `offset-step-${delta}`);
    const isPlus = delta > 0;
    btn.setAttribute('aria-label', isPlus ? `Tiến ${delta / 1000} giây` : `Lùi ${Math.abs(delta) / 1000} giây`);
    btn.style.cssText = `
      position: relative;
      z-index: 1;
      border: none;
      background: transparent;
      color: ${isPlus ? 'var(--color-success, #10b981)' : 'var(--color-info, #2563eb)'};
      cursor: pointer;
      font-family: var(--font-family, sans-serif);
      font-size: var(--font-size-xs, 12px);
      font-weight: var(--font-weight-medium, 500);
      font-variant-numeric: tabular-nums;
      padding: 8px 4px;
      min-height: 40px;
      transition: background 150ms ease, color 150ms ease;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    btn.textContent = `${isPlus ? '+' : '−'}${Math.abs(delta) / 1000}s`;
    btn.addEventListener('click', () => handlers.onStep(delta));
    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) btn.style.background = 'var(--color-surface-hover, #f1f5f9)';
    });
    btn.addEventListener('mouseleave', () => {
      if (!btn.disabled) btn.style.background = 'transparent';
    });
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
  valueInput.style.cssText = `
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-subtle, rgba(37, 99, 235, 0.1));
    color: var(--color-primary, #2563eb);
    font-family: var(--font-family, sans-serif);
    font-size: var(--font-size-lg, 16px);
    font-weight: var(--font-weight-semibold, 600);
    font-variant-numeric: tabular-nums;
    border-radius: var(--radius-sm, 6px);
    padding: 4px 8px;
    min-height: 40px;
    min-width: 0;
    width: 100%;
    border: none;
    transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease;
    text-align: center;
    outline: none;
  `;

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
  valueInput.addEventListener('focus', () => {
    valueInput.select();
    valueInput.style.zIndex = '3';
    valueInput.style.boxShadow = 'inset 0 0 0 2px var(--color-primary, #2563eb)';
    valueInput.style.background = 'var(--color-background, #ffffff)';
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
    valueInput.style.zIndex = '';
    valueInput.style.boxShadow = '';
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
  resetBtn.style.cssText = `
    width: 100%;
    padding: 8px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-full, 9999px);
    background: var(--color-surface, #f8fafc);
    color: var(--color-text-secondary, #475569);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-family: var(--font-family, sans-serif);
    font-size: var(--font-size-xs, 12px);
    font-weight: var(--font-weight-medium, 500);
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
    -webkit-tap-highlight-color: transparent;
  `;
  const resetIcon = document.createElement('span');
  resetIcon.innerHTML = RESET_SVG;
  resetIcon.style.cssText = 'display: inline-flex;';
  resetBtn.appendChild(resetIcon);
  const resetLabel = document.createElement('span');
  resetLabel.textContent = 'Đặt lại về 0';
  resetBtn.appendChild(resetLabel);
  resetBtn.addEventListener('click', () => handlers.onReset());
  resetBtn.addEventListener('mouseenter', () => {
    if (!resetBtn.disabled) {
      resetBtn.style.background = 'var(--color-error-subtle, rgba(239, 68, 68, 0.08))';
      resetBtn.style.color = 'var(--color-error, #ef4444)';
      resetBtn.style.borderColor = 'var(--color-error, #ef4444)';
    }
  });
  resetBtn.addEventListener('mouseleave', () => {
    if (!resetBtn.disabled) {
      resetBtn.style.background = 'var(--color-surface, #f8fafc)';
      resetBtn.style.color = 'var(--color-text-secondary, #475569)';
      resetBtn.style.borderColor = 'var(--color-border, #e2e8f0)';
    }
  });
  body.appendChild(resetBtn);

  // --- Disabled hint (hidden by default) ---
  const disabledHint = document.createElement('div');
  disabledHint.setAttribute('data-testid', 'offset-disabled-hint');
  disabledHint.textContent = 'Cần load subtitle trước';
  disabledHint.style.cssText = 'padding: 8px 0 0; text-align: center; color: var(--color-text-muted, #94a3b8); font-size: var(--font-size-xs, 12px); display: none;';
  body.appendChild(disabledHint);

  // === Collapse toggle ===
  let expanded = true;
  header.addEventListener('click', () => {
    expanded = !expanded;
    body.style.display = expanded ? 'block' : 'none';
    header.setAttribute('aria-expanded', String(expanded));
    chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
  });
  header.addEventListener('mouseenter', () => {
    header.style.background = 'var(--color-surface-hover)';
  });
  header.addEventListener('mouseleave', () => {
    header.style.background = 'transparent';
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

    // Value color: 0 = muted, + = success, - = info
    if (valueMs === 0) {
      valueInput.style.color = 'var(--color-text-muted, #94a3b8)';
      valueInput.style.background = 'var(--color-surface-hover, #f1f5f9)';
    } else if (valueMs > 0) {
      valueInput.style.color = 'var(--color-success, #10b981)';
      valueInput.style.background = 'var(--color-primary-subtle, rgba(37, 99, 235, 0.1))';
    } else {
      valueInput.style.color = 'var(--color-info, #2563eb)';
      valueInput.style.background = 'var(--color-primary-subtle, rgba(37, 99, 235, 0.1))';
    }

    // Disabled state
    if (!hasSubtitle) {
      allControls.forEach((c) => ((c as HTMLButtonElement | HTMLInputElement).disabled = true));
      disabledHint.style.display = 'block';
    } else {
      allControls.forEach((c) => ((c as HTMLButtonElement | HTMLInputElement).disabled = false));
      disabledHint.style.display = 'none';
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
