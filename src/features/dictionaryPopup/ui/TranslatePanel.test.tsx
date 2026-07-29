import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranslatePanel } from './TranslatePanel';

describe('TranslatePanel', () => {
  it('renders a skeleton while loading', () => {
    render(
      <TranslatePanel
        term="hello"
        sentence="hello world"
        targetLang="vi"
        translation=""
        error={null}
        loading
        selected={false}
        onToggle={jest.fn()}
        onTranslate={jest.fn()}
      />,
    );

    expect(screen.getByTestId('dictionary-translate-panel')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-translate-panel').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders an error and a translate button', () => {
    const onTranslate = jest.fn();
    render(
      <TranslatePanel
        term="hello"
        sentence="hello world"
        targetLang="vi"
        translation=""
        error="translate failed"
        loading={false}
        selected={false}
        onToggle={jest.fn()}
        onTranslate={onTranslate}
      />,
    );

    expect(screen.getByText('translate failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Translate to vi/i }));
    expect(onTranslate).toHaveBeenCalled();
  });

  it('shows the empty state and triggers translation', () => {
    const onTranslate = jest.fn();
    render(
      <TranslatePanel
        term="hello"
        sentence=""
        targetLang="vi"
        translation=""
        error={null}
        loading={false}
        selected={false}
        onToggle={jest.fn()}
        onTranslate={onTranslate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Translate to vi/i }));
    expect(onTranslate).toHaveBeenCalled();
  });

  it('renders translation and toggles selection', () => {
    const onToggle = jest.fn();
    render(
      <TranslatePanel
        term="hello"
        sentence="hello world"
        targetLang="vi"
        translation="xin chào"
        error={null}
        loading={false}
        selected={false}
        onToggle={onToggle}
        onTranslate={jest.fn()}
      />,
    );

    const block = screen.getByRole('button', { name: /xin chào/i });
    fireEvent.click(block);
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows the selected state', () => {
    render(
      <TranslatePanel
        term="hello"
        sentence="hello world"
        targetLang="vi"
        translation="xin chào"
        error={null}
        loading={false}
        selected
        onToggle={jest.fn()}
        onTranslate={jest.fn()}
      />,
    );

    const block = screen.getByRole('button', { name: /xin chào/i });
    expect(block).toHaveAttribute('aria-pressed', 'true');
  });
});
