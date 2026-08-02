import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from '@jest/globals';
import { PreviewBlock } from './PreviewBlock';

function countOccurrences(sentence: string, target: string): number {
  if (!target.trim()) return 0;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = sentence.match(new RegExp(escaped, 'g'));
  return matches?.length ?? 0;
}

describe('PreviewBlock', () => {
  it('renders target word and sentence', () => {
    const { container } = render(<PreviewBlock targetWord="study" sentence="I like to study." />);
    expect(container.querySelector('[class*="cc-preview__target"]')).toHaveTextContent('study');
    expect(container.querySelector('[class*="cc-preview__sentence"]')).toHaveTextContent('I like to study.');
  });

  it('wraps all occurrences of target word in <strong>', () => {
    const sentence = 'I like to study because study is fun.';
    const target = 'study';
    const { container } = render(<PreviewBlock targetWord={target} sentence={sentence} />);
    const strongs = container.querySelectorAll('strong');
    expect(strongs.length).toBe(countOccurrences(sentence, target));
    strongs.forEach((strong) => expect(strong.textContent).toBe(target));
  });

  it('is case-sensitive when highlighting', () => {
    const sentence = 'I like to Study, but study is hard.';
    const { container } = render(<PreviewBlock targetWord="study" sentence={sentence} />);
    const strongs = container.querySelectorAll('strong');
    expect(strongs.length).toBe(1);
    expect(strongs[0].textContent).toBe('study');
  });

  it('renders sentence without highlights when target word is empty', () => {
    const { container } = render(<PreviewBlock targetWord="" sentence="I like to study." />);
    expect(container.querySelectorAll('strong').length).toBe(0);
    expect(container.textContent).toContain('I like to study.');
  });

  it('has Preview region and aria-label', () => {
    render(<PreviewBlock targetWord="study" sentence="I like to study." />);
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('aria-label', 'Preview');
  });

  it('applies data-cell-id when dataId is provided', () => {
    render(<PreviewBlock targetWord="study" sentence="I like to study." dataId="cc-preview" />);
    expect(screen.getByTestId('cc-preview')).toBeInTheDocument();
  });
});
