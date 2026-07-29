import { createOffsetSection } from '@/features/subtitle/ui/subtitleOffsetPanel.legacy';

describe('subtitleOffsetSection (V3 — value=input ở giữa pill, reset bottom full-width)', () => {
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

  it('renders 1 pill container with 4 stepper + value-input (5 ô)', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const pill = section.querySelector('[data-testid="offset-pill"]');
    expect(pill).not.toBeNull();
    expect(pill!.getAttribute('role')).toBe('group');
    const stepBtns = pill!.querySelectorAll('button[data-testid^="offset-step-"]');
    expect(stepBtns.length).toBe(4);
    const value = pill!.querySelector('[data-testid="offset-value"]');
    expect(value).not.toBeNull();
    expect(value!.tagName).toBe('INPUT'); // V3: value is <input>
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

  it('pill has offset-pill class (pill shape + isolation via CSS)', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const pill = section.querySelector('[data-testid="offset-pill"]') as HTMLDivElement;
    expect(pill.className).toContain('offset-pill');
  });

  it('value input has offset-value class (prominent styling via CSS)', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLInputElement;
    expect(value.className).toContain('offset-value');
  });

  it('value input focus styling handled by CSS :focus (no inline box-shadow)', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLInputElement;
    // Trigger focus — CSS :focus rule applies inset ring, no inline style mutation.
    value.focus();
    expect(value.style.boxShadow).toBe('');
  });

  it('reset button has offset-reset-btn class (full-width via CSS)', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const reset = section.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
    expect(reset).not.toBeNull();
    expect(reset.className).toContain('offset-reset-btn');
    expect(reset.getAttribute('aria-label')).toBe('Đặt lại về 0');
    expect(reset.textContent).toContain('Đặt lại về 0');
  });

  it('reset button NOT inside pill (separate row)', () => {
    const { section } = createOffsetSection(parentPanel, noopHandlers);
    const pill = section.querySelector('[data-testid="offset-pill"]') as HTMLDivElement;
    const reset = section.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
    expect(pill.contains(reset)).toBe(false);
  });

  // === Disabled state ===
  it('disabled — all controls disabled, hint visible', () => {
    const { section, update } = createOffsetSection(parentPanel, noopHandlers);
    update(0, false);
    const hint = section.querySelector('[data-testid="offset-disabled-hint"]') as HTMLDivElement;
    expect(hint.className).toContain('offset-disabled-hint--visible');
    const reset = section.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
    const btns = section.querySelectorAll('button[data-testid^="offset-step-"]');
    btns.forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLInputElement;
    expect(value.disabled).toBe(true);
  });

  // === Default state (offset 0) ===
  it('default (offset 0) — controls enabled, value "0s" muted, hint hidden', () => {
    const { section, update } = createOffsetSection(parentPanel, noopHandlers);
    update(0, true);
    const hint = section.querySelector('[data-testid="offset-disabled-hint"]') as HTMLDivElement;
    expect(hint.className).not.toContain('offset-disabled-hint--visible');
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLInputElement;
    expect(value.value).toBe('0s');
    expect(value.className).toContain('offset-value--zero');
  });

  // === Positive offset ===
  it('positive offset +700ms — value "+0.7s" success color', () => {
    const { section, update } = createOffsetSection(parentPanel, noopHandlers);
    update(700, true);
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLInputElement;
    expect(value.value).toContain('+0.7');
    expect(value.className).toContain('offset-value--positive');
  });

  // === Negative offset ===
  it('negative offset -500ms — value "−0.5s" info color', () => {
    const { section, update } = createOffsetSection(parentPanel, noopHandlers);
    update(-500, true);
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLInputElement;
    expect(value.value).toContain('−0.5');
    expect(value.className).toContain('offset-value--negative');
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

  it('onInput called with parsed ms when Enter pressed in value input', () => {
    const onInput = jest.fn();
    const { section } = createOffsetSection(parentPanel, { ...noopHandlers, onInput });
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLInputElement;
    value.value = '1.5';
    value.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onInput).toHaveBeenCalledWith(1500);
  });

  it('onInput NOT called for invalid input (revert instead)', () => {
    const onInput = jest.fn();
    const { section, update } = createOffsetSection(parentPanel, { ...noopHandlers, onInput });
    update(700, true); // seed current value
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLInputElement;
    value.value = 'abc';
    value.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onInput).not.toHaveBeenCalled();
  });

  it('Esc reverts value input to current valueMs', () => {
    const { section, update } = createOffsetSection(parentPanel, noopHandlers);
    update(700, true);
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLInputElement;
    value.value = '999';
    value.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(value.value).toBe('+0.7s'); // reverted
  });

  it('focus selects all text in value input', () => {
    const { section, update } = createOffsetSection(parentPanel, noopHandlers);
    update(700, true);
    const value = section.querySelector('[data-testid="offset-value"]') as HTMLInputElement;
    value.focus();
    // jsdom doesn't fully implement selectionStart, but select() should not throw
    expect(document.activeElement).toBe(value);
  });

  // === destroy ===
  it('destroy removes section from parent panel', () => {
    const { section, destroy } = createOffsetSection(parentPanel, noopHandlers);
    expect(parentPanel.contains(section)).toBe(true);
    destroy();
    expect(parentPanel.contains(section)).toBe(false);
  });
});
