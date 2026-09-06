import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteConfirmModal } from '@/features/dictionary/ui/DeleteConfirmModal';
import type { ResourceInfo } from '@/entities/dictionary';

function makeResource(overrides: Partial<ResourceInfo> = {}): ResourceInfo {
  return {
    id: 1,
    name: 'words.txt',
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

describe('DeleteConfirmModal', () => {
  it('derives frequency wording from resource.type', () => {
    render(<DeleteConfirmModal resource={makeResource()} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Xóa danh sách?')).toBeInTheDocument();
    expect(screen.getByText(/Xóa vĩnh viễn "words\.txt" và 100 từ của nó\./)).toBeInTheDocument();
  });

  it('derives dictionary wording from resource.type', () => {
    render(<DeleteConfirmModal resource={makeResource({ type: 'DICTIONARY' })} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Xóa từ điển?')).toBeInTheDocument();
  });

  it('renders generic title/description for bulk confirm', () => {
    render(
      <DeleteConfirmModal
        title="Xóa tất cả 3 từ điển?"
        description="Xóa vĩnh viễn toàn bộ từ điển trong mục này và dữ liệu của chúng."
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('Xóa tất cả 3 từ điển?')).toBeInTheDocument();
    expect(screen.getByText(/Xóa vĩnh viễn toàn bộ từ điển/)).toBeInTheDocument();
  });

  it('calls onConfirm when delete button clicked', () => {
    const onConfirm = jest.fn();
    render(<DeleteConfirmModal resource={makeResource()} onConfirm={onConfirm} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByTestId('confirm-delete'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when "Giữ lại" clicked', () => {
    const onCancel = jest.fn();
    render(<DeleteConfirmModal resource={makeResource()} onConfirm={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Giữ lại'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when overlay clicked', () => {
    const onCancel = jest.fn();
    render(<DeleteConfirmModal resource={makeResource()} onConfirm={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('delete-confirm-modal'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not call onCancel when modal content clicked (stopPropagation)', () => {
    const onCancel = jest.fn();
    render(<DeleteConfirmModal resource={makeResource()} onConfirm={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Xóa danh sách?'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
