import { describe, expect, it, jest, beforeAll, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { PopupDictionary } from './PopupDictionary';

jest.mock('./DictionaryPanelView', () => ({
  DictionaryPanelView: function DictionaryPanelViewMock(props: Record<string, unknown>) {
    return (
      <div data-cell-id="dictionary-panel-mock">
        <span data-cell-id="mock-lang">{props.langCode as string}</span>
        <span data-cell-id="mock-initial">{(props.initialTerm as string | undefined) ?? ''}</span>
      </div>
    );
  },
}));

const defaultAnchor = { top: 70, left: 100, right: 150, bottom: 100 };

beforeAll(() => {
  if (typeof PointerEvent === 'undefined') {
    class MockPointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MockPointerEvent as unknown as typeof MouseEvent;
  }

  globalThis.requestAnimationFrame = jest.fn((cb: FrameRequestCallback): number => {
    cb(0);
    return 0;
  }) as unknown as typeof requestAnimationFrame;
});

beforeEach(() => {
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 1024, configurable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: 768, configurable: true });
});

describe('PopupDictionary', () => {
  it('renders as a dialog with a header, content, sheet handle and resize handle', () => {
    render(
      <PopupDictionary
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Dictionary popup');
    expect(screen.queryByTestId('popup-dictionary-header')).not.toBeInTheDocument();
    expect(screen.getByTestId('popup-dictionary-content')).toBeInTheDocument();
    expect(screen.getByTestId('popup-dictionary-resize')).toBeInTheDocument();
    // Sheet handle only renders in sheet mode (via shared Sheet atom); in
    // popup mode (desktop viewport) it is absent.
    expect(screen.queryByTestId('popup-dictionary-sheet-handle')).not.toBeInTheDocument();
    expect(screen.getByTestId('dictionary-panel-mock')).toBeInTheDocument();
    expect(screen.getByTestId('mock-lang')).toHaveTextContent('en');
  });

  it('passes initial term and language props to DictionaryPanelView', () => {
    render(
      <PopupDictionary
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        initialTerm="hello"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('mock-initial')).toHaveTextContent('hello');
  });

  it('applies the supplied style to the dialog', () => {
    render(
      <PopupDictionary
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        onClose={jest.fn()}
        style={{ left: 100, top: 200 }}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ left: '100px', top: '200px' });
  });

  it('derives initial position from anchor and viewport', () => {
    render(
      <PopupDictionary
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        onClose={jest.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ left: '154px', top: '104px' });
  });

  it('switches to sheet layout in a narrow viewport', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });

    render(
      <PopupDictionary
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        onClose={jest.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    // Sheet mode renders the shared Sheet atom — no resize handle (popup-only).
    expect(screen.queryByTestId('popup-dictionary-resize')).not.toBeInTheDocument();
    // Sheet inline style includes height (from useSheet), not width: 100%.
    expect(dialog).toHaveStyle({ height: '300px' });
  });

});
