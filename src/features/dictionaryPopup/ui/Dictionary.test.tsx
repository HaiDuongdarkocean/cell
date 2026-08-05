import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dictionary } from './Dictionary';

jest.mock('./usePopupPosition', () => ({
  usePopupPosition: jest.fn(() => ({
    style: {},
    isSheet: false,
    popupRef: { current: null },
    onPointerDownHeader: jest.fn(),
    onPointerDownResize: jest.fn(),
    onPointerDownSheet: jest.fn(),
    onPointerDownContent: jest.fn(),
  })),
}));

jest.mock('./DictionaryPanelView', () => ({
  DictionaryPanelView: function DictionaryPanelViewMock(props: Record<string, unknown>) {
    return (
      <div
        data-cell-id="dictionary-panel"
        data-mock-is-open={String(props.isOpen)}
        data-mock-lang={props.langCode as string}
      >
        {props.initialTerm ? <span data-cell-id="dictionary-mock-initial">{props.initialTerm as string}</span> : null}
      </div>
    );
  },
}));

const defaultAnchor = { top: 70, left: 100, right: 150, bottom: 100 };

describe('Dictionary', () => {
  it('renders the popup variant with chrome and panel', () => {
    render(
      <Dictionary
        variant="popup"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('popup-dictionary')).toBeInTheDocument();
    expect(screen.queryByTestId('popup-dictionary-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('popup-dictionary-content')).toBeInTheDocument();
    expect(screen.getByTestId('popup-dictionary-resize')).toBeInTheDocument();
    expect(screen.getByTestId('popup-dictionary-sheet-handle')).toBeInTheDocument();

    const panel = screen.getByTestId('dictionary-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-mock-is-open', 'true');
    expect(panel).toHaveAttribute('data-mock-lang', 'en');
  });

  it('passes the search term to the popup panel', () => {
    render(
      <Dictionary
        variant="popup"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        initialTerm="hello"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('dictionary-mock-initial')).toHaveTextContent('hello');
  });

  it('renders the integrated variant without popup chrome', () => {
    render(
      <Dictionary
        variant="integrated"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
      />,
    );

    expect(screen.queryByTestId('popup-dictionary-header')).not.toBeInTheDocument();

    const panel = screen.getByTestId('dictionary-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-mock-is-open', 'true');
    expect(panel).toHaveAttribute('data-mock-lang', 'en');
    expect(screen.getByTestId('dictionary-mock-initial')).toHaveTextContent('hello');
  });

  it('passes isOpen to the integrated panel', () => {
    render(
      <Dictionary
        variant="integrated"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        isOpen={false}
      />,
    );

    expect(screen.getByTestId('dictionary-panel')).toHaveAttribute('data-mock-is-open', 'false');
  });

  it('closes the popup when Escape is pressed on the popup container', () => {
    const onClose = jest.fn();
    render(
      <Dictionary
        variant="popup"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        onClose={onClose}
      />,
    );
    const popup = screen.getByTestId('popup-dictionary');
    fireEvent.keyDown(popup, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when non-Escape key is pressed', () => {
    const onClose = jest.fn();
    render(
      <Dictionary
        variant="popup"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        onClose={onClose}
      />,
    );
    const popup = screen.getByTestId('popup-dictionary');
    fireEvent.keyDown(popup, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
