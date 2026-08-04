import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { DictionaryToolbar } from './DictionaryToolbar';

describe('DictionaryToolbar', () => {
  it('renders four tab buttons', () => {
    render(<DictionaryToolbar activeTab={null} onSelect={jest.fn()} counts={{}} />);

    expect(screen.getByTestId('dictionary-tab-audio')).toHaveTextContent('Audio');
    expect(screen.getByTestId('dictionary-tab-image')).toHaveTextContent('Image');
    expect(screen.getByTestId('dictionary-tab-translate')).toHaveTextContent('Translate');
    expect(screen.getByTestId('dictionary-tab-links')).toHaveTextContent('Links');
  });

  it('calls onSelect with the clicked tab', () => {
    const onSelect = jest.fn();
    render(<DictionaryToolbar activeTab={null} onSelect={onSelect} counts={{}} />);

    fireEvent.click(screen.getByTestId('dictionary-tab-image'));
    expect(onSelect).toHaveBeenCalledWith('image');
  });

  it('marks the active tab with aria-selected and aria-pressed', () => {
    render(<DictionaryToolbar activeTab="audio" onSelect={jest.fn()} counts={{}} />);

    const audio = screen.getByTestId('dictionary-tab-audio');
    expect(audio).toHaveAttribute('aria-selected', 'true');
    expect(audio).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows selection count badges', () => {
    render(
      <DictionaryToolbar
        activeTab={null}
        onSelect={jest.fn()}
        counts={{ audio: 2, image: 0, translate: 1, links: 3 }}
      />,
    );

    expect(screen.getByTestId('dictionary-tab-audio')).toHaveTextContent('2');
    expect(screen.getByTestId('dictionary-tab-image')).not.toHaveTextContent('0');
    expect(screen.getByTestId('dictionary-tab-translate')).toHaveTextContent('1');
    // Links tab does not show a badge
    expect(screen.getByTestId('dictionary-tab-links')).not.toHaveTextContent('3');
  });
});
