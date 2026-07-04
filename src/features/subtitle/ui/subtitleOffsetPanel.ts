/**
 * Subtitle offset section — DOM factory (ADR-019 V2 simplified).
 *
 * V2 (2026-07-05): drop Apply button, drop lazy badge, drop 3-state reset label.
 * UI = 1 pill với 6 ô: [−2s][−0.5s][VALUE][+0.5s][+2s][↺]
 * - Value ở giữa, to + đậm + bg primary-subtle (nhấn mạnh)
 * - Reset (↺) cuối pill, cạnh value
 * - Stepper 4 nút chia bằng hairline divider
 * - Pill shape (--radius-full), soft, không rời rạc
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

const STEPPER_DELTAS = [-2000, -500, 500, 2000] as const;

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

  // === Pill — 1 container bo tròn, 6 ô chia bằng hairline divider ===
  // Layout: [−2s][−0.5s][VALUE to][+0.5s][+2s][↺]
  // Value ô có bg primary-subtle, to + đậm. Reset ô = icon.
  const pill = document.createElement('div');
  pill.setAttribute('data-testid', 'offset-pill');
  pill.setAttribute('role', 'group');
  pill.setAttribute('aria-label', 'Subtitle offset control');
  pill.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr 1.4fr 1fr 1fr 0.8fr;
    align-items: stretch;
    background: var(--color-surface, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-full, 9999px);
    padding: 3px;
    gap: 0;
    margin-bottom: 8px;
  `;
  body.appendChild(pill);

  // --- Stepper buttons (4 nút: −2s, −0.5s, +0.5s, +2s) ---
  const stepBtns: HTMLButtonElement[] = [];
  for (const delta of STEPPER_DELTAS) {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-testid', `offset-step-${delta}`);
    const isPlus = delta > 0;
    btn.setAttribute('aria-label', isPlus ? `Tiến ${delta / 1000} giây` : `Lùi ${Math.abs(delta) / 1000} giây`);
    btn.style.cssText = `
      border: none;
      border-right: 1px solid var(--color-border-subtle, #f1f5f9);
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
    pill.appendChild(btn);
    stepBtns.push(btn);
  }

  // --- Value display (ô giữa, to + đậm + bg primary-subtle) ---
  const valueCell = document.createElement('div');
  valueCell.setAttribute('data-testid', 'offset-value');
  valueCell.setAttribute('role', 'status');
  valueCell.setAttribute('aria-label', 'Current offset');
  valueCell.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-subtle, rgba(37, 99, 235, 0.1));
    color: var(--color-primary, #2563eb);
    font-family: var(--font-family, sans-serif);
    font-size: var(--font-size-lg, 16px);
    font-weight: var(--font-weight-semibold, 600);
    font-variant-numeric: tabular-nums;
    border-radius: var(--radius-full, 9999px);
    padding: 4px 8px;
    min-height: 40px;
    border: none;
    border-right: 1px solid var(--color-border-subtle, #f1f5f9);
    transition: color 150ms ease;
  `;
  pill.appendChild(valueCell);

  // --- Reset button (cuối pill, icon ↺) ---
  const resetBtn = document.createElement('button');
  resetBtn.setAttribute('type', 'button');
  resetBtn.setAttribute('data-testid', 'offset-reset');
  resetBtn.setAttribute('aria-label', 'Đặt lại về 0');
  resetBtn.setAttribute('title', 'Đặt lại về 0');
  resetBtn.style.cssText = `
    border: none;
    background: transparent;
    color: var(--color-text-muted, #94a3b8);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 8px 4px;
    border-radius: var(--radius-full, 9999px);
    transition: background 150ms ease, color 150ms ease;
    -webkit-tap-highlight-color: transparent;
  `;
  resetBtn.innerHTML = RESET_SVG;
  resetBtn.addEventListener('click', () => handlers.onReset());
  resetBtn.addEventListener('mouseenter', () => {
    if (!resetBtn.disabled) {
      resetBtn.style.background = 'var(--color-error-subtle, rgba(239, 68, 68, 0.08))';
      resetBtn.style.color = 'var(--color-error, #ef4444)';
    }
  });
  resetBtn.addEventListener('mouseleave', () => {
    if (!resetBtn.disabled) {
      resetBtn.style.background = 'transparent';
      resetBtn.style.color = 'var(--color-text-muted, #94a3b8)';
    }
  });
  pill.appendChild(resetBtn);

  // --- Input row (nhập số giây trực tiếp) ---
  const inputRow = document.createElement('div');
  inputRow.style.cssText = 'display: flex; gap: 3px;';
  const inputWrap = document.createElement('div');
  inputWrap.style.cssText = 'flex: 1; display: flex; align-items: center; border: 1px solid var(--color-border, #e2e8f0); border-radius: var(--radius-full, 9999px); background: var(--color-background, #ffffff); overflow: hidden;';
  const input = document.createElement('input');
  input.setAttribute('type', 'text');
  input.setAttribute('data-testid', 'offset-input');
  input.setAttribute('aria-label', 'Nhập độ lệch (giây)');
  input.setAttribute('placeholder', 'nhập số giây');
  input.style.cssText = 'flex: 1; border: none; padding: 6px 12px; min-height: 32px; background: transparent; color: var(--color-text); font-family: var(--font-family, sans-serif); font-size: var(--font-size-sm, 13px); font-variant-numeric: tabular-nums; outline: none;';
  const inputSuffix = document.createElement('span');
  inputSuffix.textContent = 's';
  inputSuffix.style.cssText = 'padding: 0 10px; color: var(--color-text-muted, #94a3b8); font-size: var(--font-size-xs, 12px); user-select: none;';
  inputWrap.appendChild(input);
  inputWrap.appendChild(inputSuffix);
  inputRow.appendChild(inputWrap);
  body.appendChild(inputRow);

  // Input commit on Enter + blur
  const commitInput = (): void => {
    const parsed = parseOffsetInputSafe(input.value);
    if (parsed === null) {
      // Invalid — reset input to current value
      if (document.activeElement !== input) {
        input.value = valueMsToText(currentValueMs);
      }
      return;
    }
    handlers.onInput(parsed);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInput();
      input.blur();
    }
  });
  input.addEventListener('blur', commitInput);

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
  const allControls = [resetBtn, ...stepBtns, input];

  function update(valueMs: number, hasSubtitle: boolean): void {
    currentValueMs = valueMs;

    // Value display (to, đậm, primary color)
    const display = formatOffsetValue(valueMs);
    valueCell.textContent = display;

    // Value color: 0 = muted, + = success, - = info
    if (valueMs === 0) {
      valueCell.style.color = 'var(--color-text-muted, #94a3b8)';
      valueCell.style.background = 'var(--color-surface-hover, #f1f5f9)';
    } else if (valueMs > 0) {
      valueCell.style.color = 'var(--color-success, #10b981)';
      valueCell.style.background = 'var(--color-primary-subtle, rgba(37, 99, 235, 0.1))';
    } else {
      valueCell.style.color = 'var(--color-info, #2563eb)';
      valueCell.style.background = 'var(--color-primary-subtle, rgba(37, 99, 235, 0.1))';
    }

    // Disabled state
    if (!hasSubtitle) {
      allControls.forEach((c) => ((c as HTMLButtonElement | HTMLInputElement).disabled = true));
      disabledHint.style.display = 'block';
    } else {
      allControls.forEach((c) => ((c as HTMLButtonElement | HTMLInputElement).disabled = false));
      disabledHint.style.display = 'none';
    }

    // Input value sync (giây) — only when not focused
    if (document.activeElement !== input) {
      input.value = valueMsToText(valueMs);
    }
  }

  // === Destroy ===
  function destroy(): void {
    section.remove();
  }

  return { section, header, body, update, destroy };
}

// === Helpers ===

/** Format ms → display string for value cell: 0 → "0s", 700 → "+0.7s", -500 → "-0.5s". */
function formatOffsetValue(ms: number): string {
  if (ms === 0) return '0s';
  const seconds = ms / 1000;
  const sign = ms > 0 ? '+' : '−';
  const absSeconds = Math.abs(seconds);
  // Trim trailing .0 — 1.0s → 1s, 0.5s → 0.5s
  const formatted = absSeconds % 1 === 0 ? String(absSeconds) : String(absSeconds);
  return `${sign}${formatted}s`;
}

/** Convert valueMs → input text (giây). 0 → "", 700 → "0.7", -500 → "-0.5". */
function valueMsToText(ms: number): string {
  if (ms === 0) return '';
  return String(ms / 1000);
}

/** Parse input string → ms. Wrapper để tránh import cycle. */
function parseOffsetInputSafe(input: string): number | null {
  // Inline parse để giữ panel pure (không import logic module — tránh circular)
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const cleaned = trimmed.endsWith('s') || trimmed.endsWith('S')
    ? trimmed.slice(0, -1).trim()
    : trimmed;
  if (cleaned === '') return null;
  const seconds = Number(cleaned);
  if (!Number.isFinite(seconds)) return null;
  const ms = Math.round(seconds * 1000);
  if (ms < -60_000 || ms > 60_000) return null;
  return ms;
}
