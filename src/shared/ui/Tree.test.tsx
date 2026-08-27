import { render, screen, fireEvent } from '@testing-library/react';
import { Tree } from './Tree';

const nodes = [
  {
    id: 'root',
    label: 'Root',
    children: [
      { id: 'child-1', label: 'Child 1' },
      { id: 'child-2', label: 'Child 2' },
    ],
  },
];

describe('Tree', () => {
  it('renders tree with accessible role and label', () => {
    render(
      <Tree
        nodes={nodes}
        expandedIds={[]}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
        ariaLabel="File tree"
      />,
    );
    expect(screen.getByRole('tree')).toHaveAttribute('aria-label', 'File tree');
    expect(screen.getByText('Root')).toBeInTheDocument();
  });

  it('renders children when expanded', () => {
    render(
      <Tree
        nodes={nodes}
        expandedIds={['root']}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
      />,
    );
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('calls onToggle and onSelect when a branch is clicked', () => {
    const onSelect = jest.fn();
    const onToggle = jest.fn();
    render(
      <Tree
        nodes={nodes}
        expandedIds={[]}
        onSelect={onSelect}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByText('Root'));
    expect(onToggle).toHaveBeenCalledWith('root', true);
    expect(onSelect).toHaveBeenCalledWith('root', expect.objectContaining({ id: 'root', label: 'Root' }));
  });

  it('supports keyboard Enter/Space to activate a node', () => {
    const onSelect = jest.fn();
    render(
      <Tree
        nodes={nodes}
        expandedIds={[]}
        onSelect={onSelect}
        onToggle={jest.fn()}
      />,
    );
    const root = screen.getByText('Root').closest('[role="treeitem"]');
    if (!root) throw new Error('treeitem not found');
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('root', expect.objectContaining({ id: 'root', label: 'Root' }));
  });

  it('marks the active node with aria-selected', () => {
    render(
      <Tree
        nodes={nodes}
        expandedIds={[]}
        activeId="root"
        onSelect={jest.fn()}
        onToggle={jest.fn()}
      />,
    );
    const item = screen.getByText('Root').closest('[role="treeitem"]');
    expect(item).toHaveAttribute('aria-selected', 'true');
  });
});
