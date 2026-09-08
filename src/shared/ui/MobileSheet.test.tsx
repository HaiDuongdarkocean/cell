import { render, screen, fireEvent } from '@testing-library/react';
import { MobileSheet } from './MobileSheet';

// jsdom has no PointerEvent and no layout — dispatch MouseEvent-typed
// pointer events (React listens by event name) and stub measurements.

function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'lostpointercapture',
  target: Element,
  init: { clientY: number; pointerId?: number; button?: number },
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientY: init.clientY,
    button: init.button ?? 0,
  });
  Object.assign(event, { pointerId: init.pointerId ?? 1, pointerType: 'mouse' });
  fireEvent(target, event);
}

/** Stub the layout metrics the sheet measures during a drag. */
function mockLayout(sheet: HTMLElement, container: HTMLElement, containerHeight: number, sheetHeight: number): void {
  Object.defineProperty(sheet, 'offsetParent', { configurable: true, value: container });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: containerHeight });
  sheet.getBoundingClientRect = () => ({ height: sheetHeight }) as DOMRect;
}

function getSheet(): HTMLElement {
  return screen.getByTestId('mobile-sheet');
}

function getPill(): HTMLElement {
  return screen.getByTestId('card-creator-sheet-pill');
}

describe('MobileSheet', () => {
  it('renders a visible pill drag handle with data-cell-id="card-creator-sheet-pill"', () => {
    render(<MobileSheet data-cell-id="mobile-sheet">Body</MobileSheet>);
    const pill = getPill();
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute('role', 'button');
    expect(pill).toHaveAttribute('tabindex', '0');
  });

  it('renders header and scrollable content', () => {
    render(
      <MobileSheet data-cell-id="mobile-sheet" header={<span>Create card — neko</span>}>
        <p>Form body</p>
      </MobileSheet>,
    );
    expect(screen.getByText('Create card — neko')).toBeInTheDocument();
    expect(screen.getByText('Form body')).toBeInTheDocument();
  });

  it('starts collapsed at the 56px peek snap point', () => {
    render(<MobileSheet data-cell-id="mobile-sheet">Body</MobileSheet>);
    expect(getSheet()).toHaveClass('snapCollapsed');
    expect(getPill()).toHaveAttribute('aria-expanded', 'false');
  });

  it('tapping the pill toggles collapsed ↔ last expanded snap point', () => {
    const onSnapChange = jest.fn();
    render(<MobileSheet data-cell-id="mobile-sheet" onSnapChange={onSnapChange}>Body</MobileSheet>);
    const pill = getPill();

    // Tap — expand to the default expanded snap (half).
    pointer('pointerdown', pill, { clientY: 500 });
    pointer('pointerup', pill, { clientY: 500 });
    expect(onSnapChange).toHaveBeenLastCalledWith('half');
    expect(getSheet()).toHaveClass('snapHalf');
    expect(getPill()).toHaveAttribute('aria-expanded', 'true');

    // Tap — collapse back to the peek.
    pointer('pointerdown', pill, { clientY: 500 });
    pointer('pointerup', pill, { clientY: 500 });
    expect(onSnapChange).toHaveBeenLastCalledWith('collapsed');
    expect(getSheet()).toHaveClass('snapCollapsed');
  });

  it('tapping re-expands to the last expanded snap point, not always half', () => {
    render(<MobileSheet data-cell-id="mobile-sheet">Body</MobileSheet>);
    const pill = getPill();

    // Expand fully via keyboard, then collapse, then tap → back to 'full'.
    fireEvent.keyDown(pill, { key: 'Home' });
    expect(getSheet()).toHaveClass('snapFull');
    fireEvent.keyDown(pill, { key: 'End' });
    expect(getSheet()).toHaveClass('snapCollapsed');
    pointer('pointerdown', pill, { clientY: 500 });
    pointer('pointerup', pill, { clientY: 500 });
    expect(getSheet()).toHaveClass('snapFull');
  });

  it('dragging the pill resizes and snaps to the nearest point on release', () => {
    const onSnapChange = jest.fn();
    render(
      <div data-mock-container>
        <MobileSheet data-cell-id="mobile-sheet" onSnapChange={onSnapChange}>Body</MobileSheet>
      </div>,
    );
    const sheet = getSheet();
    const container = sheet.parentElement as HTMLElement;
    const pill = getPill();
    // Container 1000px; sheet resting at 56px peek.
    mockLayout(sheet, container, 1000, 56);

    // Drag up: startHeight 56 + (500 - 200) = 356px → nearer to half (500) than collapsed (56).
    pointer('pointerdown', pill, { clientY: 500 });
    pointer('pointermove', pill, { clientY: 200 });
    expect(sheet).toHaveClass('dragging');
    pointer('pointerup', pill, { clientY: 200 });
    expect(onSnapChange).toHaveBeenLastCalledWith('half');
    expect(sheet).toHaveClass('snapHalf');
    expect(sheet).not.toHaveClass('dragging');

    // From half (500px), drag up past the container → clamps to 1000px = full.
    mockLayout(sheet, container, 1000, 500);
    pointer('pointerdown', pill, { clientY: 500 });
    pointer('pointermove', pill, { clientY: -400 });
    pointer('pointerup', pill, { clientY: -400 });
    expect(onSnapChange).toHaveBeenLastCalledWith('full');
    expect(sheet).toHaveClass('snapFull');
  });

  it('a small drag below the tap threshold still counts as a tap', () => {
    const onSnapChange = jest.fn();
    render(<MobileSheet data-cell-id="mobile-sheet" onSnapChange={onSnapChange}>Body</MobileSheet>);
    const pill = getPill();
    pointer('pointerdown', pill, { clientY: 500 });
    pointer('pointermove', pill, { clientY: 503 });
    pointer('pointerup', pill, { clientY: 503 });
    expect(onSnapChange).toHaveBeenLastCalledWith('half');
  });

  it('supports keyboard control: Enter/Space toggles, arrows step, Home/End jump', () => {
    const onSnapChange = jest.fn();
    render(<MobileSheet data-cell-id="mobile-sheet" onSnapChange={onSnapChange}>Body</MobileSheet>);
    const pill = getPill();

    fireEvent.keyDown(pill, { key: 'Enter' });
    expect(onSnapChange).toHaveBeenLastCalledWith('half');
    fireEvent.keyDown(pill, { key: 'ArrowUp' });
    expect(onSnapChange).toHaveBeenLastCalledWith('full');
    fireEvent.keyDown(pill, { key: 'ArrowDown' });
    expect(onSnapChange).toHaveBeenLastCalledWith('half');
    fireEvent.keyDown(pill, { key: ' ' });
    expect(onSnapChange).toHaveBeenLastCalledWith('collapsed');
  });

  it('supports controlled snap for programmatic open to 50% or 100%', () => {
    const { rerender } = render(
      <MobileSheet data-cell-id="mobile-sheet" snap="half">Body</MobileSheet>,
    );
    expect(getSheet()).toHaveClass('snapHalf');
    rerender(<MobileSheet data-cell-id="mobile-sheet" snap="full">Body</MobileSheet>);
    expect(getSheet()).toHaveClass('snapFull');
  });

  it('in controlled mode a tap reports onSnapChange without self-updating', () => {
    const onSnapChange = jest.fn();
    render(<MobileSheet data-cell-id="mobile-sheet" snap="collapsed" onSnapChange={onSnapChange}>Body</MobileSheet>);
    const pill = getPill();
    pointer('pointerdown', pill, { clientY: 500 });
    pointer('pointerup', pill, { clientY: 500 });
    expect(onSnapChange).toHaveBeenCalledWith('half');
    // Parent did not update the prop — snap stays collapsed.
    expect(getSheet()).toHaveClass('snapCollapsed');
  });

  it('defaultSnap opens uncontrolled at a given snap point', () => {
    render(<MobileSheet data-cell-id="mobile-sheet" defaultSnap="full">Body</MobileSheet>);
    expect(getSheet()).toHaveClass('snapFull');
  });
});
