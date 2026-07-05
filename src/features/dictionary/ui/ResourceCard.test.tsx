import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceCard } from '@/features/dictionary/ui/ResourceCard';
import type { ResourceInfo } from '@/entities/dictionary';

function makeResource(overrides: Partial<ResourceInfo> = {}): ResourceInfo {
  return {
    id: 1,
    name: 'test.txt',
    langCode: 'en',
    type: 'FREQUENCY',
    format: 'txt',
    signature: 'sig',
    wordCount: 100,
    installationFinished: true,
    importedAt: Date.now(),
    ...overrides,
  };
}

describe('ResourceCard', () => {
  it('renders name + wordCount + format', () => {
    render(<ResourceCard resource={makeResource({ name: 'words.txt', wordCount: 42, format: 'txt' })} onDelete={jest.fn()} />);
    expect(screen.getByText('words.txt')).toBeInTheDocument();
    expect(screen.getByText(/txt · 42 mục/)).toBeInTheDocument();
  });

  it('shows "đang import..." when installationFinished is false', () => {
    render(<ResourceCard resource={makeResource({ installationFinished: false })} onDelete={jest.fn()} />);
    expect(screen.getByText(/đang import/)).toBeInTheDocument();
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = jest.fn();
    render(<ResourceCard resource={makeResource({ name: 'words.txt' })} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('delete-button-1'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('has accessible aria-label for delete button', () => {
    render(<ResourceCard resource={makeResource({ name: 'words.txt' })} onDelete={jest.fn()} />);
    expect(screen.getByLabelText('Xóa words.txt')).toBeInTheDocument();
  });
});
