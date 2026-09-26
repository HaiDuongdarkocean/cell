import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { DictLinksManager } from './DictLinksManager';
import type { ExternalDictLinkTemplate } from '@/entities/settings';

const LINKS: ExternalDictLinkTemplate[] = [
  { id: 'a', name: 'Cambridge', urlTemplate: 'https://dictionary.cambridge.org/{term}', langCodes: [] },
  { id: 'b', name: 'Wiktionary', urlTemplate: 'https://en.wiktionary.org/wiki/{term}', langCodes: ['en'] },
];

function renderManager(links = LINKS): jest.Mock<(l: readonly ExternalDictLinkTemplate[]) => void> {
  const onChange = jest.fn<(l: readonly ExternalDictLinkTemplate[]) => void>();
  render(<DictLinksManager links={links} onChange={onChange} />);
  return onChange;
}

describe('DictLinksManager', () => {
  it('renders stored links as rows with name and url preview', () => {
    renderManager();
    expect(screen.getByText('Cambridge')).toBeInTheDocument();
    expect(screen.getByText('https://en.wiktionary.org/wiki/{term}')).toBeInTheDocument();
  });

  it('shows the empty state when no links exist', () => {
    renderManager([]);
    expect(screen.getByText(/no dictionary links/i)).toBeInTheDocument();
  });

  it('add opens the editor dialog and saves a new link', () => {
    const onChange = renderManager();
    fireEvent.click(screen.getByRole('button', { name: /add link/i }));
    fireEvent.change(screen.getByTestId('dict-link-editor-name'), { target: { value: 'Google Translate' } });
    fireEvent.change(screen.getByTestId('dict-link-editor-url'), { target: { value: 'https://translate.google.com/?text={term}' } });
    fireEvent.click(screen.getByTestId('dict-link-editor-save'));
    expect(onChange).toHaveBeenCalledWith([
      ...LINKS,
      expect.objectContaining({
        name: 'Google Translate',
        urlTemplate: 'https://translate.google.com/?text={term}',
        langCodes: [],
      }),
    ]);
  });

  it('rejects an invalid url template without mutating state', () => {
    const onChange = renderManager();
    fireEvent.click(screen.getByRole('button', { name: /add link/i }));
    fireEvent.change(screen.getByTestId('dict-link-editor-name'), { target: { value: 'Bad' } });
    fireEvent.change(screen.getByTestId('dict-link-editor-url'), { target: { value: 'javascript:alert({term})' } });
    fireEvent.click(screen.getByTestId('dict-link-editor-save'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('pencil opens a prefilled editor that updates name and url', () => {
    const onChange = renderManager();
    fireEvent.click(screen.getByRole('button', { name: /edit cambridge/i }));
    const nameInput = screen.getByTestId('dict-link-editor-name');
    expect(nameInput).toHaveValue('Cambridge');
    fireEvent.change(nameInput, { target: { value: 'Cambridge EN' } });
    fireEvent.change(screen.getByTestId('dict-link-editor-url'), { target: { value: 'https://cam.example/{lang}/{term}' } });
    fireEvent.click(screen.getByTestId('dict-link-editor-save'));
    expect(onChange).toHaveBeenCalledWith([
      { ...LINKS[0], name: 'Cambridge EN', urlTemplate: 'https://cam.example/{lang}/{term}' },
      LINKS[1],
    ]);
  });

  it('clicking a name opens inline rename that saves on Enter', () => {
    const onChange = renderManager();
    fireEvent.click(screen.getByRole('button', { name: /rename cambridge/i }));
    const input = screen.getByTestId('dict-link-rename-a');
    fireEvent.change(input, { target: { value: 'Cambridge UK' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith([
      { ...LINKS[0], name: 'Cambridge UK' },
      LINKS[1],
    ]);
  });

  it('delete requires confirmation and removes the link', () => {
    const onChange = renderManager();
    fireEvent.click(screen.getByRole('button', { name: /delete cambridge/i }));
    fireEvent.click(screen.getByTestId('dict-link-delete-confirm'));
    expect(onChange).toHaveBeenCalledWith([LINKS[1]]);
  });

  it('ArrowDown on the drag handle reorders the list', () => {
    const onChange = renderManager();
    fireEvent.keyDown(screen.getByRole('button', { name: /drag cambridge/i }), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith([LINKS[1], LINKS[0]]);
  });

  it('preserves langCodes when renaming', () => {
    const onChange = renderManager();
    fireEvent.click(screen.getByRole('button', { name: /rename wiktionary/i }));
    const input = screen.getByTestId('dict-link-rename-b');
    fireEvent.change(input, { target: { value: 'Wiki' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith([
      LINKS[0],
      { ...LINKS[1], name: 'Wiki', langCodes: ['en'] },
    ]);
  });
});
