/**
 * Subtitle offset section — DOM factory (ADR-019 Contract 5).
 *
 * Section collapsible nested trong Subtitle Manager Panel (mimic createSection pattern).
 * Render 4 states (disabled / default / lazy-active / committed) theo mockup v2.2.
 * Source of truth UI: docs/mockups/mockup-subtitle-time-offset.html
 *
 * Inversion of control: nhận handlers callback, không biết OffsetController logic.
 *
 * @see docs/mockups/mockup-subtitle-time-offset.html (v2.2 approved)
 */

import type { OffsetState } from '../logic/subtitleOffset';
import { formatOffsetDisplay } from '../logic/subtitleOffset';

/** Section API — returned by createOffsetSection. */
export interface OffsetSectionApi {
  readonly section: HTMLDivElement;
  readonly header: HTMLButtonElement;
  readonly body: HTMLDivElement;
  /** Update UI theo state + hasSubtitle flag. */
  update(state: OffsetState, hasSubtitle: boolean): void;
  /** Flash apply button "✓ Đã lưu" 1.5s (trigger từ click OR auto-commit). */
  flashSaved(): void;
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
  /** Apply button clicked. */
  onApply: () => void;
}

const CHEVRON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>';
const RESET_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M18.364 8.05026L17.6569 7.34315C14.5327 4.21896 9.46734 4.21896 6.34315 7.34315C3.21895 10.4673 3.21895 15.5327 6.34315 18.6569C9.46734 21.7811 14.5327 21.7811 17.6569 18.6569C19.4737 16.84 20.234 14.3668 19.9377 12.0005M18.364 8.05026H14.1213M18.364 8.05026V3.80762" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const STEPPER_DELTAS = [-2000, -500, 500, 2000] as const;

/**
 * Create offset section — DOM factory pattern. Nested trong Subtitle Manager Panel.
 *
 * @param parentPanel - Manager panel element (section appended here)
 * @param handlers - Callbacks for step/input/reset/apply
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

  // === Header (collapsible, mimic createSection pattern) ===
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

  // Value display in header (compact, right-aligned)
  const valueSpan = document.createElement('span');
  valueSpan.setAttribute('data-testid', 'offset-value');
  valueSpan.style.cssText = 'font-size: var(--font-size-xs, 12px); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-text-muted);';
  header.appendChild(valueSpan);

  section.appendChild(header);

  // === Body ===
  const body = document.createElement('div');
  body.setAttribute('data-testid', 'offset-section-body');
  body.style.cssText = 'padding: 0 var(--spacing-xs, 4px) var(--spacing-xs, 4px); display: block;';
  section.appendChild(body);

  // --- Stepper ---
  const stepper = document.createElement('div');
  stepper.setAttribute('data-testid', 'offset-stepper');
  stepper.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; margin-bottom: 8px;';
  const stepBtns: HTMLButtonElement[] = [];
  for (const delta of STEPPER_DELTAS) {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-testid', `offset-step-${delta}`);
    const isPlus = delta > 0;
    btn.setAttribute('aria-label', isPlus ? `Tiến ${delta / 1000} giây` : `Lùi ${Math.abs(delta) / 1000} giây`);
    btn.style.cssText = `
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 6px 2px;
      min-height: 40px;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      background: var(--color-surface, #f8fafc);
      color: var(--color-text);
      cursor: pointer;
      font-family: var(--font-family, sans-serif);
      transition: background 150ms ease, border-color 150ms ease, transform 80ms ease;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    `;
    const valSpan = document.createElement('span');
    valSpan.textContent = `${isPlus ? '+' : '−'}${Math.abs(delta) / 1000}s`;
    valSpan.style.cssText = `font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; color: ${isPlus ? 'var(--color-success, #10b981)' : 'var(--color-info, #2563eb)'};`;
    btn.appendChild(valSpan);
    btn.addEventListener('click', () => handlers.onStep(delta));
    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) {
        btn.style.background = 'var(--color-surface-hover, #f1f5f9)';
        btn.style.borderColor = 'var(--color-border-focus, #2563eb)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (!btn.disabled) {
        btn.style.background = 'var(--color-surface, #f8fafc)';
        btn.style.borderColor = 'var(--color-border, #e2e8f0)';
      }
    });
    stepper.appendChild(btn);
    stepBtns.push(btn);
  }
  body.appendChild(stepper);

  // --- Input row ---
  const inputRow = document.createElement('div');
  inputRow.style.cssText = 'display: flex; gap: 3px;';
  const inputWrap = document.createElement('div');
  inputWrap.style.cssText = 'flex: 1; display: flex; align-items: center; border: 1px solid var(--color-border, #e2e8f0); border-radius: var(--radius-sm, 6px); background: var(--color-background, #ffffff); overflow: hidden;';
  const input = document.createElement('input');
  input.setAttribute('type', 'text');
  input.setAttribute('data-testid', 'offset-input');
  input.setAttribute('aria-label', 'Nhập độ lệch (giây)');
  input.setAttribute('placeholder', 'nhập số giây');
  input.style.cssText = 'flex: 1; border: none; padding: 6px 8px; min-height: 32px; background: transparent; color: var(--color-text); font-family: var(--font-family, sans-serif); font-size: 12px; font-variant-numeric: tabular-nums; outline: none;';
  const inputSuffix = document.createElement('span');
  inputSuffix.textContent = 's';
  inputSuffix.style.cssText = 'padding: 0 6px; color: var(--color-text-muted, #94a3b8); font-size: 10px; user-select: none;';
  inputWrap.appendChild(input);
  inputWrap.appendChild(inputSuffix);
  const applyBtn = document.createElement('button');
  applyBtn.setAttribute('type', 'button');
  applyBtn.setAttribute('data-testid', 'offset-apply');
  applyBtn.setAttribute('aria-label', 'Áp dụng');
  applyBtn.textContent = 'Áp dụng';
  applyBtn.style.cssText = `
    padding: 0 8px; min-height: 32px; min-width: 64px;
    border: none; border-radius: var(--radius-sm, 6px);
    background: var(--color-primary, #2563eb);
    color: var(--color-text-inverse, #ffffff);
    cursor: pointer; font-size: 11px; font-weight: 500;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 150ms ease, transform 80ms ease;
  `;
  applyBtn.addEventListener('click', () => handlers.onApply());
  inputRow.appendChild(inputWrap);
  inputRow.appendChild(applyBtn);
  body.appendChild(inputRow);

  // --- Reset button (full-width, below input row) ---
  const resetBtn = document.createElement('button');
  resetBtn.setAttribute('type', 'button');
  resetBtn.setAttribute('data-testid', 'offset-reset');
  resetBtn.setAttribute('aria-label', 'Đặt lại');
  resetBtn.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    margin-top: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-sm, 6px);
    background: var(--color-surface, #f8fafc);
    color: var(--color-text-secondary, #475569);
    cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 4px;
    font-family: var(--font-family, sans-serif);
    font-size: 11px; font-weight: 500;
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
  `;
  const resetIcon = document.createElement('span');
  resetIcon.innerHTML = RESET_SVG;
  resetIcon.style.cssText = 'display: inline-flex;';
  resetBtn.appendChild(resetIcon);
  const resetLabel = document.createElement('span');
  resetLabel.textContent = 'Đặt lại';
  resetBtn.appendChild(resetLabel);
  resetBtn.addEventListener('click', () => handlers.onReset());
  resetBtn.addEventListener('mouseenter', () => {
    if (!resetBtn.disabled) {
      resetBtn.style.background = 'var(--color-error-subtle, rgba(239,68,68,0.08))';
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
  disabledHint.style.cssText = 'padding: 8px 0 0; text-align: center; color: var(--color-text-muted, #94a3b8); font-size: 11px; display: none;';
  body.appendChild(disabledHint);

  // === Collapse toggle (mimic createSection headerClick) ===
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
  const allControls = [resetBtn, ...stepBtns, input, applyBtn];

  function update(state: OffsetState, hasSubtitle: boolean): void {
    // Value display in header (compact: +0.5s / -2s / 0s)
    const display = formatOffsetDisplay(state.valueMs);
    const numText = typeof display === 'string' ? display.replace(/s$/, '') : String(display);
    const sign = state.valueMs > 0 ? '+' : state.valueMs < 0 ? '−' : '';
    const absText = state.valueMs === 0 ? '0' : numText.replace(/^[+\-]/, '');
    valueSpan.textContent = `${sign}${absText}s`;

    // Value color
    if (state.valueMs === 0) {
      valueSpan.style.color = 'var(--color-text-muted, #94a3b8)';
    } else if (state.valueMs > 0) {
      valueSpan.style.color = 'var(--color-success, #10b981)';
    } else {
      valueSpan.style.color = 'var(--color-info, #2563eb)';
    }

    // Reset aria-label theo state
    if (state.mode === 'lazy') {
      resetBtn.setAttribute('aria-label', 'Hủy xem thử');
      resetBtn.setAttribute('title', 'Hủy xem thử');
      resetLabel.textContent = 'Hủy xem thử';
    } else if (state.valueMs !== 0) {
      resetBtn.setAttribute('aria-label', 'Đặt lại về 0');
      resetBtn.setAttribute('title', 'Đặt lại về 0');
      resetLabel.textContent = 'Đặt lại về 0';
    } else {
      resetBtn.setAttribute('aria-label', 'Đặt lại');
      resetBtn.removeAttribute('title');
      resetLabel.textContent = 'Đặt lại';
    }

    // Disabled state
    if (!hasSubtitle) {
      allControls.forEach((c) => ((c as HTMLButtonElement | HTMLInputElement).disabled = true));
      disabledHint.style.display = 'block';
    } else {
      allControls.forEach((c) => ((c as HTMLButtonElement | HTMLInputElement).disabled = false));
      disabledHint.style.display = 'none';
    }

    // Input value sync (giây)
    if (document.activeElement !== input) {
      input.value = state.valueMs === 0 ? '' : String(state.valueMs / 1000);
    }
  }

  // === Flash saved ===
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  function flashSaved(): void {
    if (flashTimer) clearTimeout(flashTimer);
    applyBtn.classList.add('saved');
    applyBtn.style.background = 'var(--color-success, #10b981)';
    applyBtn.textContent = '✓ Đã lưu';
    applyBtn.setAttribute('aria-label', 'Đã lưu');
    flashTimer = setTimeout(() => {
      applyBtn.classList.remove('saved');
      applyBtn.style.background = 'var(--color-primary, #2563eb)';
      applyBtn.textContent = 'Áp dụng';
      applyBtn.setAttribute('aria-label', 'Áp dụng');
      flashTimer = null;
    }, 1500);
  }

  // === Destroy ===
  function destroy(): void {
    if (flashTimer) clearTimeout(flashTimer);
    section.remove();
  }

  return { section, header, body, update, flashSaved, destroy };
}
