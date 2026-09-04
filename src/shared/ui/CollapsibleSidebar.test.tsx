import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSidebar } from './CollapsibleSidebar';

describe('CollapsibleSidebar', () => {
  const sections = [
    {
      id: 'main',
      items: [
        { id: 'dictionary', icon: 'bookOpen' as const, label: 'Dictionary', active: true },
        { id: 'study', icon: 'slidersHorizontal' as const, label: 'Study' },
      ],
    },
    {
      id: 'tools',
      items: [
        { id: 'reader', icon: 'library' as const, label: 'Reader' },
      ],
    },
  ];

  it('renders all section items and labels', () => {
    render(<CollapsibleSidebar sections={sections} />);
    expect(screen.getByText('Dictionary')).toBeInTheDocument();
    expect(screen.getByText('Study')).toBeInTheDocument();
    expect(screen.getByText('Reader')).toBeInTheDocument();
  });

  it('hides labels and shows expand toggle when collapsed', () => {
    const onToggle = jest.fn();
    render(<CollapsibleSidebar sections={sections} collapsed onCollapsedChange={onToggle} />);
    const toggle = screen.getByLabelText('Expand sidebar');
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('calls item onClick', () => {
    const onStudy = jest.fn();
    const withClick = sections.map((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === 'study' ? { ...i, onClick: onStudy } : i)),
    }));
    render(<CollapsibleSidebar sections={withClick} />);
    fireEvent.click(screen.getByText('Study'));
    expect(onStudy).toHaveBeenCalled();
  });
});
