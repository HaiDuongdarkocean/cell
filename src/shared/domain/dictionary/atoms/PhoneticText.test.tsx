import { render, screen } from '@testing-library/react';
import { PhoneticText } from './PhoneticText';

describe('PhoneticText', () => {
  it('renders the phonetic text', () => {
    render(<PhoneticText>/həˈloʊ/</PhoneticText>);
    expect(screen.getByText('/həˈloʊ/')).toBeInTheDocument();
  });

  it('renders a span element', () => {
    const { container } = render(<PhoneticText>/test/</PhoneticText>);
    expect(container.querySelector('span')).not.toBeNull();
  });

  it('merges custom className', () => {
    const { container } = render(<PhoneticText className="extra">/test/</PhoneticText>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
