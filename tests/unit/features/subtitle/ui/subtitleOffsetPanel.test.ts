import { createOffsetSection } from '@/features/subtitle/ui/subtitleOffsetPanel';

describe('subtitleOffsetSection (V2 — direct apply, no lazy/badge/apply button)', () => {
  let parentPanel: HTMLDivElement;

  beforeEach(() => {
    parentPanel = document.createElement('div');
    parentPanel.setAttribute('data-testid', 'subtitle-manager-panel');
    document.body.appendChild(parentPanel);
  });

  afterEach(() => {
    parentPanel.remove();
  });

  const noopHandlers = { onStep: () => {}, onInput: () => {}, onReset: () => {} };

  it('renders section with header label "OFFSET"', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    expect(section.getAttribute('data-testid')).toBe('offset-section');
    expect(section.getAttribute('data-role')).toBe('offset');
    expect(section.textContent).toContain('OFFSET');
  });

  it('section appended vào parent manager panel', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    expect(parentPanel.contains(section)).toBe(true);
  });

  it('header collapsible with aria-expanded + chevron', () => {
    const { header } = createOffsetSection(parentPanel, noopHandlers);
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(header.getAttribute('aria-label')).toBe('Toggle Offset section');
  });

  it('click header collapses body (toggle)', () => {
    const { header, body } = createOffsetSection(parentPanel, noopHandlers);
    header.click();
    expect(body.style.display).toBe('none');
    expect(header.getAttribute('aria-expanded')).toBe('false');
    header.click();
    expect(body.style.display).toBe('block');
    expect(header.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders 1 pill container with 4 stepper + value + reset', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const pill = section.querySelector('[data-testid="offset-pill"]');
    expect(pill).not.toBeNull();
    expect(pill!.getAttribute('role')).toBe('group');
    // 4 step buttons + value cell + reset button = 6 children
    const stepBtns = pill!.querySelectorAll('button[data-testid^="offset-step-"]');
    expect(stepBtns.length).toBe(4);
    const value = pill!.querySelector('[data-testid="offset-value"]');
    expect(value).not.toBeNull();
    const reset = pill!.querySelector('[data-testid="offset-reset"]');
    expect(reset).not.toBeNull();
  });

  it('renders 4 stepper buttons with correct aria-labels', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const btns = section.querySelectorAll('button[data-testid^="offset-step-"]');
    expect(btns.length).toBe(4);
    expect(btns[0].getAttribute('aria-label')).toBe('Lùi 2 giây');
    expect(btns[1].getAttribute('aria-label')).toBe('Lùi 0.5 giây');
    expect(btns[2].getAttribute('aria-label')).toBe('Tiến 0.5 giây');
    expect(btns[3].getAttribute('aria-label')).toBe('Tiến 2 giây');
  });

  it('renders input with placeholder "nhập số giây"', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const input = section.querySelector('[data-testid="offset-input"]') as HTMLInputElement;
    expect(input.placeholder).toBe('nhập số giây');
    expect(input.getAttribute('aria-label')).toBe('Nhập độ lệch (giây)');
  });

  it('pill has border-radius full (pill shape)', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const pill = section.querySelector('[data-testid="offset-pill"]') as HTMLDivElement;
    expect(pill.style.borderRadius).toContain('9999');
  });

  it('value cell has prominent styling (large font + semibold)', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLDivElement;
    expect(value.style.fontSize).toContain('16'); // --font-size-lg
    expect(value.style.fontWeight).toContain('600'); // --font-weight-semibold
  });

  it('reset button has aria-label "Đặt lại về 0"', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const reset = section.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
    expect(reset.getAttribute('aria-label')).toBe('Đặt lại về 0');
  });

  // === Disabled state ===
  it('disabled — all controls disabled, hint visible', () => {
    const { section, update } = createOffsetSection(parentPanel, noopHandlers);
    update(0, false);
    const hint = section.querySelector('[data-testid="offset-disabled-hint"]') as HTMLDivElement;
    expect(hint.style.display).toBe('block');
    const reset = section.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
    const btns = section.querySelectorAll('button[data-testid^="offset-step-"]');
    btns.forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
    const input = section.querySelector('[data-testid="offset-input"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  // === Default state (offset 0) ===
  it('default (offset 0) — controls enabled, value "0s" muted, hint hidden', () => {
    const { section, update } = createOffsetSection(parentPanel, noopHandlers);
    update(0, true);
    const hint = section.querySelector('[data-testid="offset-disabled-hint"]') as HTMLDivElement;
    expect(hint.style.display).toBe('none');
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLDivElement;
    expect(value.textContent).toBe('0s');
    expect(value.style.color).toContain('muted');
  });

  // === Positive offset ===
  it('positive offset +700ms — value "+0.7s" success color', () => {
    const { section, update } = createOffsetSection(parentPanel, noopHandlers);
    update(700, true);
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLDivElement;
    expect(value.textContent).toContain('+0.7');
    expect(value.style.color).toContain('success');
  });

  // === Negative offset ===
  it('negative offset -500ms — value "−0.5s" info color', () => {
    const { section, update } = createOffsetSection(parentPanel, noopHandlers);
    update(-500, true);
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLDivElement;
    expect(value.textContent).toContain('−0.5');
    expect(value.style.color).toContain('info');
  });

  // === Handlers ===
  it('onStep called with deltaMs when stepper clicked', () => {
    const onStep = jest.fn();
    const { section } = createOffsetSection(parentPanel, { ...noopHandlers, onStep });
    const btn = section.querySelector('[data-testid="offset-step-500"]') as HTMLButtonElement;
    btn.click();
    expect(onStep).toHaveBeenCalledWith(500);
  });

  it('onStep called with -2000 for −2s button', () => {
    const onStep = jest.fn();
    const { section } = createOffsetSection(parentPanel, { ...noopHandlers, onStep });
    const btn = section.querySelector('[data-testid="offset-step--2000"]') as HTMLButtonElement;
    btn.click();
    expect(onStep).toHaveBeenCalledWith(-2000);
  });

  it('onReset called when reset button clicked', () => {
    const onReset = jest.fn();
    const { section } = createOffsetSection(parentPanel, { ...noopHandlers, onReset });
    section.querySelector('[data-testid="offset-reset"]')!.dispatchEvent(new MouseEvent('click'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('onInput called with parsed ms when Enter pressed in input', () => {
    const onInput = jest.fn();
    const { section } = createOffsetSection(parentPanel, { ...noopHandlers, onInput });
    const input = section.querySelector('[data-testid="offset-input"]') as HTMLInputElement;
    input.value = '1.5';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onInput).toHaveBeenCalledWith(1500);
  });

  it('onInput called with null for invalid input on blur', () => {
    const onInput = jest.fn();
    const { section } = createOffsetSection(parentPanel, { ...noopHandlers, onInput });
    const input = section.querySelector('[data-testid="offset-input"]') as HTMLInputElement;
    input.value = 'abc';
    input.dispatchEvent(new Event('blur'));
    // Invalid → onInput not called (panel resets input)
    expect(onInput).not.toHaveBeenCalled();
  });

  // === destroy ===
  it('destroy removes section from parent panel', () => {
    const { section, destroy } = createOffsetSection(parentPanel, noopHandlers);
    expect(parentPanel.contains(section)).toBe(true);
    destroy();
    expect(parentPanel.contains(section)).toBe(false);
  });
});
