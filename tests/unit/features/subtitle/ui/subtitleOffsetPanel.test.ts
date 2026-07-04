import { createOffsetPanel } from '@/features/subtitle/ui/subtitleOffsetPanel';
import type { OffsetState } from '@/features/subtitle/logic/subtitleOffset';
import { INITIAL_OFFSET_STATE } from '@/features/subtitle/logic/subtitleOffset';

describe('subtitleOffsetPanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function makeState(partial: Partial<OffsetState>): OffsetState {
    return { ...INITIAL_OFFSET_STATE, ...partial };
  }

  it('renders panel with title "Độ lệch" and role dialog', () => {
    const { panel } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-label')).toBe('Độ lệch subtitle');
    expect(panel.textContent).toContain('Độ lệch');
  });

  it('renders 4 stepper buttons with correct labels', () => {
    const { panel } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    const stepper = panel.querySelector('[data-testid="offset-stepper"]');
    expect(stepper).not.toBeNull();
    const btns = stepper!.querySelectorAll('button');
    expect(btns.length).toBe(4);
    expect(btns[0].getAttribute('aria-label')).toBe('Lùi 2 giây');
    expect(btns[1].getAttribute('aria-label')).toBe('Lùi 0.5 giây');
    expect(btns[2].getAttribute('aria-label')).toBe('Tiến 0.5 giây');
    expect(btns[3].getAttribute('aria-label')).toBe('Tiến 2 giây');
  });

  it('renders input with placeholder "nhập số giây" and suffix "s"', () => {
    const { panel } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    const input = panel.querySelector('[data-testid="offset-input"]') as HTMLInputElement;
    expect(input.placeholder).toBe('nhập số giây');
    expect(input.getAttribute('aria-label')).toBe('Nhập độ lệch (giây)');
    expect(panel.textContent).toContain('s');
  });

  it('renders apply button with text "Áp dụng"', () => {
    const { panel } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    const apply = panel.querySelector('[data-testid="offset-apply"]') as HTMLButtonElement;
    expect(apply.textContent).toBe('Áp dụng');
    expect(apply.getAttribute('aria-label')).toBe('Áp dụng');
  });

  // === State 1: disabled ===
  it('state 1 disabled — all controls disabled, hint visible', () => {
    const { panel, update } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    update(INITIAL_OFFSET_STATE, false);
    const hint = panel.querySelector('[data-testid="offset-disabled-hint"]') as HTMLDivElement;
    expect(hint.style.display).toBe('block');
    const reset = panel.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
    const stepper = panel.querySelector('[data-testid="offset-stepper"]')!;
    stepper.querySelectorAll('button').forEach((b) => expect(b.disabled).toBe(true));
    const input = panel.querySelector('[data-testid="offset-input"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  // === State 2: default (committed, offset 0) ===
  it('state 2 default — controls enabled, value "0s" muted, hint hidden', () => {
    const { panel, update } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    update(INITIAL_OFFSET_STATE, true);
    const hint = panel.querySelector('[data-testid="offset-disabled-hint"]') as HTMLDivElement;
    expect(hint.style.display).toBe('none');
    const reset = panel.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
    expect(reset.disabled).toBe(false);
    const value = panel.querySelector('[data-testid="offset-value"]') as HTMLSpanElement;
    expect(value.textContent).toContain('0');
    expect(value.style.color).toContain('muted');
  });

  // === State 3: lazy active (offset +700ms) ===
  it('state 3 lazy — value "+0.7s" success color, reset aria "Hủy xem thử"', () => {
    const { panel, update } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    const lazyState = makeState({ valueMs: 700, mode: 'lazy', lastActionAt: Date.now() });
    update(lazyState, true);
    const value = panel.querySelector('[data-testid="offset-value"]') as HTMLSpanElement;
    expect(value.textContent).toContain('+0.7');
    expect(value.style.color).toContain('success');
    const reset = panel.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
    expect(reset.getAttribute('aria-label')).toBe('Hủy xem thử');
  });

  it('state 3 lazy negative — value "-0.5s" info color', () => {
    const { panel, update } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    const lazyState = makeState({ valueMs: -500, mode: 'lazy', lastActionAt: Date.now() });
    update(lazyState, true);
    const value = panel.querySelector('[data-testid="offset-value"]') as HTMLSpanElement;
    expect(value.textContent).toContain('−0.5');
    expect(value.style.color).toContain('info');
  });

  // === State 4: committed (offset +700ms, persisted) ===
  it('state 4 committed — value "+0.7s", reset aria "Đặt lại về 0"', () => {
    const { panel, update } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    const committedState = makeState({ valueMs: 700, mode: 'committed' });
    update(committedState, true);
    const value = panel.querySelector('[data-testid="offset-value"]') as HTMLSpanElement;
    expect(value.textContent).toContain('+0.7');
    const reset = panel.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
    expect(reset.getAttribute('aria-label')).toBe('Đặt lại về 0');
  });

  // === Handlers ===
  it('onStep called with deltaMs when stepper clicked', () => {
    const onStep = jest.fn();
    const { panel } = createOffsetPanel(container, {
      onStep, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    const btn = panel.querySelector('[data-testid="offset-step-500"]') as HTMLButtonElement;
    btn.click();
    expect(onStep).toHaveBeenCalledWith(500);
  });

  it('onStep called with -2000 for −2s button', () => {
    const onStep = jest.fn();
    const { panel } = createOffsetPanel(container, {
      onStep, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    const btn = panel.querySelector('[data-testid="offset-step--2000"]') as HTMLButtonElement;
    btn.click();
    expect(onStep).toHaveBeenCalledWith(-2000);
  });

  it('onReset called when reset button clicked', () => {
    const onReset = jest.fn();
    const { panel } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset, onApply: () => {},
    });
    panel.querySelector('[data-testid="offset-reset"]')!.dispatchEvent(new MouseEvent('click'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('onApply called when apply button clicked', () => {
    const onApply = jest.fn();
    const { panel } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply,
    });
    panel.querySelector('[data-testid="offset-apply"]')!.dispatchEvent(new MouseEvent('click'));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  // === flashSaved ===
  it('flashSaved changes apply button to "✓ Đã lưu" with success bg', () => {
    const { panel, flashSaved } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    flashSaved();
    const apply = panel.querySelector('[data-testid="offset-apply"]') as HTMLButtonElement;
    expect(apply.textContent).toBe('✓ Đã lưu');
    expect(apply.getAttribute('aria-label')).toBe('Đã lưu');
    expect(apply.style.background).toContain('success');
  });

  it('flashSaved reverts to "Áp dụng" after 1.5s', (done) => {
    const { panel, flashSaved } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    flashSaved();
    const apply = panel.querySelector('[data-testid="offset-apply"]') as HTMLButtonElement;
    setTimeout(() => {
      expect(apply.textContent).toBe('Áp dụng');
      expect(apply.getAttribute('aria-label')).toBe('Áp dụng');
      done();
    }, 1600);
  });

  // === destroy ===
  it('destroy removes panel from DOM', () => {
    const { panel, destroy } = createOffsetPanel(container, {
      onStep: () => {}, onInput: () => {}, onReset: () => {}, onApply: () => {},
    });
    expect(container.contains(panel)).toBe(true);
    destroy();
    expect(container.contains(panel)).toBe(false);
  });
});
