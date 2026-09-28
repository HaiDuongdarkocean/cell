import { render, screen } from '@testing-library/react';
import { PartOfSpeechTag } from './PartOfSpeechTag';

describe('PartOfSpeechTag', () => {
  it('renders the label text', () => {
    render(<PartOfSpeechTag type="noun">noun</PartOfSpeechTag>);
    expect(screen.getByText('noun')).toBeInTheDocument();
  });

  it('renders a span element', () => {
    const { container } = render(<PartOfSpeechTag type="verb">verb</PartOfSpeechTag>);
    expect(container.querySelector('span')).not.toBeNull();
  });

  it('renders correct aria-label for each type', () => {
    const cases = [
      ['noun', 'Noun'],
      ['verb', 'Verb'],
      ['adjective', 'Adjective'],
      ['adverb', 'Adverb'],
      ['preposition', 'Preposition'],
      ['conjunction', 'Conjunction'],
      ['pronoun', 'Pronoun'],
      ['interjection', 'Interjection'],
    ] as const;
    for (const [type, label] of cases) {
      const { unmount } = render(<PartOfSpeechTag type={type}>{type}</PartOfSpeechTag>);
      expect(screen.getByLabelText(`Part of speech: ${label}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('applies the type-specific class', () => {
    const { container } = render(<PartOfSpeechTag type="noun">noun</PartOfSpeechTag>);
    expect(container.firstChild).toHaveClass('noun');
  });

  it('merges custom className', () => {
    const { container } = render(<PartOfSpeechTag type="noun" className="extra">noun</PartOfSpeechTag>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
