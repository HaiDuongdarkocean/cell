import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteConfirmModal } from '@/features/dictionary/ui/DeleteConfirmModal';
import type { ResourceInfo } from '@/entities/dictionary';

function makeResource(): ResourceInfo {
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
  };
}

describe('DeleteConfirmModal', () => {
  it('renders with resource name + wordCount', () => {
    render(<DeleteConfirmModal resource={makeResource()} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText(/words.txt/)).toBeInTheDocument();
    expect(screen.getByText(/100 mục/)).toBeInTheDocument();
  });

  it('calls onConfirm when delete button clicked', () => {
    const onConfirm = jest.fn();
    render(<DeleteConfirmModal resource={makeResource()} onConfirm={onConfirm} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByTestId('confirm-delete'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = jest.fn();
    render(<DeleteConfirmModal resource={makeResource()} onConfirm={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Hủy bỏ'));
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
    fireEvent.click(screen.getByText('Xác nhận xóa'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
