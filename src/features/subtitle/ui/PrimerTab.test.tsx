import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { PrimerTab } from './PrimerTab';
import type { PrimerRow } from '../logic/primerList';

function row(partial: Partial<PrimerRow> & Pick<PrimerRow, 'term'>): PrimerRow {
  return {
    status: 'unknown',
    count: 1,
    rank: 100,
    band: 'core',
    contextText: `sentence with ${partial.term}`,
    firstCueIndex: 0,
    firstCueStartMs: 1000,
    firstCueEndMs: 3000,
    firstTokenOffset: 14,
    ...partial,
  };
}

describe('PrimerTab', () => {
  it('renders the count header and a breakdown when both statuses are present', () => {
    const rows = [
      row({ term: 'a' }),
      row({ term: 'b' }),
      row({ term: 'c', status: 'tracking' }),
    ];
    render(<PrimerTab rows={rows} onTokenClick={jest.fn()} onSeek={jest.fn()} />);
    expect(screen.getByText('3 new words')).toBeTruthy();
    expect(screen.getByText('2 unknown · 1 tracking')).toBeTruthy();
  });

  it('omits the breakdown when only one status is present', () => {
    render(<PrimerTab rows={[row({ term: 'a' }), row({ term: 'b' })]} onTokenClick={jest.fn()} onSeek={jest.fn()} />);
    expect(screen.getByText('2 new words')).toBeTruthy();
    expect(screen.queryByText(/unknown · /)).toBeNull();
  });

  it('renders rows with term, status, count, band badge, and seek button', () => {
    render(
      <PrimerTab
        rows={[row({ term: 'negotiate', count: 4, rank: 321, band: 'general', status: 'tracking' })]}
        onTokenClick={jest.fn()}
        onSeek={jest.fn()}
      />,
    );
    const termEl = screen.getByText('negotiate');
    expect(termEl.classList.contains('js-cell-token')).toBe(true);
    expect(termEl.getAttribute('data-cell-term')).toBe('negotiate');
    expect(termEl.getAttribute('data-cell-start')).toBe('14');
    expect(screen.getByText('Tracking')).toBeTruthy();
    expect(screen.getByText('×4')).toBeTruthy();
    expect(screen.getByText('321')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Seek to "negotiate" at 0:01/ })).toBeTruthy();
  });

  it('carries cue range attributes on the row for subtitle-lookup detection', () => {
    render(
      <PrimerTab
        rows={[row({ term: 'w', firstCueStartMs: 1234, firstCueEndMs: 5678 })]}
        onTokenClick={jest.fn()}
        onSeek={jest.fn()}
      />,
    );
    const rowEl = screen.getByText('w').closest('[data-cue-start]');
    expect(rowEl?.getAttribute('data-cue-start')).toBe('1234');
    expect(rowEl?.getAttribute('data-cue-end')).toBe('5678');
  });

  it('hides the band badge when band is none', () => {
    render(<PrimerTab rows={[row({ term: 'w', band: 'none', rank: null })]} onTokenClick={jest.fn()} onSeek={jest.fn()} />);
    expect(screen.queryByLabelText(/Frequency:/)).toBeNull();
  });

  it('calls onTokenClick with term, term element, and context on row click', () => {
    const onTokenClick = jest.fn();
    render(<PrimerTab rows={[row({ term: 'fragile', contextText: 'a fragile peace' })]} onTokenClick={onTokenClick} onSeek={jest.fn()} />);
    const rowEl = screen.getByText('fragile').closest('[role="button"]') as HTMLElement;
    fireEvent.click(rowEl);
    expect(onTokenClick).toHaveBeenCalledTimes(1);
    const [term, el, ctx] = onTokenClick.mock.calls[0] as [string, HTMLElement, string];
    expect(term).toBe('fragile');
    expect(ctx).toBe('a fragile peace');
    expect(el.getAttribute('data-cell-start')).toBe('14');
  });

  it('fires lookup on Enter and Space keys', () => {
    const onTokenClick = jest.fn();
    render(<PrimerTab rows={[row({ term: 'w' })]} onTokenClick={onTokenClick} onSeek={jest.fn()} />);
    const rowEl = screen.getByText('w').closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(rowEl, { key: 'Enter' });
    fireEvent.keyDown(rowEl, { key: ' ' });
    expect(onTokenClick).toHaveBeenCalledTimes(2);
  });

  it('calls onSeek without triggering lookup when the seek button is clicked', () => {
    const onTokenClick = jest.fn();
    const onSeek = jest.fn();
    render(
      <PrimerTab
        rows={[row({ term: 'w', firstCueStartMs: 61_000 })]}
        onTokenClick={onTokenClick}
        onSeek={onSeek}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Seek to "w" at 1:01/ }));
    expect(onSeek).toHaveBeenCalledWith(61_000);
    expect(onTokenClick).not.toHaveBeenCalled();
  });

  it('renders the empty state when there are no rows', () => {
    render(<PrimerTab rows={[]} onTokenClick={jest.fn()} onSeek={jest.fn()} />);
    expect(screen.getByText('All words known')).toBeTruthy();
  });
});
