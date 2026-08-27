import { render, screen } from '@testing-library/react';
import { LabelGroup } from './LabelGroup';

jest.mock('@/shared/icons/Icon', () => ({
  Icon: ({ name }: { name: string }) => <svg data-testid={`icon-${name}`} />,
}));

describe('LabelGroup', () => {
  it('renders label and icon', () => {
    render(<LabelGroup icon={<span data-cell-id="leading" />} label="Primary label" />);
    expect(screen.getByText('Primary label')).toBeInTheDocument();
    expect(screen.getByTestId('leading')).toBeInTheDocument();
  });

  it('renders sublabel below label', () => {
    render(<LabelGroup label="Primary" sublabel="Secondary helper" />);
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Secondary helper')).toBeInTheDocument();
  });

  it('renders hint icon with accessible label', () => {
    render(<LabelGroup label="Primary" hint="Tooltip content" />);
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'More info' })).toBeInTheDocument();
  });

  it('renders trailing element', () => {
    render(<LabelGroup label="Primary" trailing={<button type="button">Edit</button>} />);
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
