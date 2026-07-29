import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { PopupDictionary } from './PopupDictionary';

jest.mock('./DictionaryPanelView', () => ({
  DictionaryPanelView: function DictionaryPanelViewMock(props: Record<string, unknown>) {
    return (
      <div data-testid="dictionary-panel-mock">
        <span data-testid="mock-lang">{props.langCode as string}</span>
        <span data-testid="mock-initial">{(props.initialTerm as string | undefined) ?? ''}</span>
      </div>
    );
  },
}));

describe('PopupDictionary', () => {
  it('renders as a dialog with a header, content, and resize handle', () => {
    render(
      <PopupDictionary
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Dictionary popup');
    expect(screen.getByTestId('popup-dictionary-header')).toBeInTheDocument();
    expect(screen.getByTestId('popup-dictionary-content')).toBeInTheDocument();
    expect(screen.getByTestId('popup-dictionary-resize')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-panel-mock')).toBeInTheDocument();
    expect(screen.getByTestId('mock-lang')).toHaveTextContent('en');
  });

  it('passes initial term and language props to DictionaryPanelView', () => {
    render(
      <PopupDictionary
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('mock-initial')).toHaveTextContent('hello');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <PopupDictionary
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('applies the supplied style to the dialog', () => {
    render(
      <PopupDictionary
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        onClose={jest.fn()}
        style={{ left: 100, top: 200 }}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ left: '100px', top: '200px' });
  });
});
