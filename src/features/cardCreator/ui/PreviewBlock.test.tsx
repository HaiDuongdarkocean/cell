import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, jest } from '@jest/globals';
import { PreviewBlock } from './PreviewBlock';

function countOccurrences(sentence: string, target: string): number {
  if (!target.trim()) return 0;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = sentence.match(new RegExp(escaped, 'g'));
  return matches?.length ?? 0;
}

function findTokenByTerm(container: HTMLElement, term: string): HTMLElement | null {
  return container.querySelector(`[data-tihoka-term="${term}"]`) as HTMLElement | null;
}

describe('PreviewBlock', () => {
  it('renders target word and sentence', () => {
    const { container } = render(<PreviewBlock targetWord="study" sentence="I like to study." />);
    expect(container.querySelector('[class*="cc-preview__target"]')).toHaveTextContent('study');
    expect(container.querySelector('[class*="cc-preview__sentence"]')).toHaveTextContent('I like to study.');
  });

  it('tokenizes the sentence into word spans', () => {
    const { container } = render(<PreviewBlock targetWord="study" sentence="I like to study." />);
    const sentence = container.querySelector('[class*="cc-preview__sentence"]')!;
    const tokens = sentence.querySelectorAll('[data-tihoka-term]');
    expect(tokens.length).toBe(4);
    expect(tokens[0]).toHaveAttribute('data-tihoka-term', 'i');
    expect(tokens[1]).toHaveAttribute('data-tihoka-term', 'like');
    expect(tokens[2]).toHaveAttribute('data-tihoka-term', 'to');
    expect(tokens[3]).toHaveAttribute('data-tihoka-term', 'study');
  });

  it('wraps all occurrences of target word in <strong>', () => {
    const sentence = 'I like to study because study is fun.';
    const target = 'study';
    const { container } = render(<PreviewBlock targetWord={target} sentence={sentence} />);
    const strongs = container.querySelectorAll('strong');
    expect(strongs.length).toBe(countOccurrences(sentence, target));
    strongs.forEach((strong) => expect(strong.textContent?.toLowerCase()).toBe(target));
  });

  it('highlights the target word regardless of case', () => {
    const sentence = 'I like to Study, but study is hard.';
    const { container } = render(<PreviewBlock targetWord="study" sentence={sentence} />);
    const strongs = container.querySelectorAll('strong');
    expect(strongs.length).toBe(2);
    expect(strongs[0]?.textContent?.toLowerCase()).toBe('study');
    expect(strongs[1]?.textContent?.toLowerCase()).toBe('study');
  });

  it('highlights multi-word target phrases', () => {
    const sentence = 'I like to study hard because study hard is fun.';
    const { container } = render(<PreviewBlock targetWord="study hard" sentence={sentence} />);
    const strongs = container.querySelectorAll('strong');
    expect(strongs.length).toBe(2);
    strongs.forEach((strong) => expect(strong.textContent?.toLowerCase()).toBe('study hard'));
  });

  it('renders sentence without highlights when target word is empty', () => {
    const { container } = render(<PreviewBlock targetWord="" sentence="I like to study." />);
    expect(container.querySelectorAll('strong').length).toBe(0);
    expect(container.textContent).toContain('I like to study.');
  });

  it('calls onTokenClick with the term and sentence when a token is clicked', () => {
    const onTokenClick = jest.fn();
    const { container } = render(
      <PreviewBlock targetWord="study" sentence="I like to study." onTokenClick={onTokenClick} />,
    );
    const token = findTokenByTerm(container, 'study');
    expect(token).not.toBeNull();
    fireEvent.click(token!);
    expect(onTokenClick).toHaveBeenCalledWith('study', 'I like to study.');
  });

  it('does not call onTokenClick when it is not provided', () => {
    const { container } = render(<PreviewBlock targetWord="study" sentence="I like to study." />);
    const token = findTokenByTerm(container, 'study');
    expect(token).not.toBeNull();
    expect(() => fireEvent.click(token!)).not.toThrow();
  });

  it('has Preview region and aria-label', () => {
    render(<PreviewBlock targetWord="study" sentence="I like to study." />);
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('aria-label', 'Preview');
  });

  it('applies data-tihoka-id when dataId is provided', () => {
    render(<PreviewBlock targetWord="study" sentence="I like to study." dataId="cc-preview" />);
    expect(screen.getByTestId('cc-preview')).toBeInTheDocument();
  });
});
