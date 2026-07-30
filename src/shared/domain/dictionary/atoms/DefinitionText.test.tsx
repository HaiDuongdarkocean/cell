import { render, screen } from '@testing-library/react';
import { DefinitionText } from './DefinitionText';

describe('DefinitionText', () => {
  it('renders a p element by default', () => {
    const { container } = render(<DefinitionText>A fortunate accident.</DefinitionText>);
    expect(container.querySelector('p')).not.toBeNull();
    expect(screen.getByText('A fortunate accident.')).toBeInTheDocument();
  });

  it('renders a li element when index is provided', () => {
    const { container } = render(<DefinitionText index={1}>A fortunate accident.</DefinitionText>);
    expect(container.querySelector('li')).not.toBeNull();
  });

  it('renders the index number when provided', () => {
    render(<DefinitionText index={2}>Second definition.</DefinitionText>);
    expect(screen.getByText('2.')).toBeInTheDocument();
  });

  it('renders without index number by default', () => {
    const { container } = render(<DefinitionText>No index.</DefinitionText>);
    expect(container.querySelector('.number')).toBeNull();
  });

  it('merges custom className', () => {
    const { container } = render(<DefinitionText className="extra">test</DefinitionText>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
