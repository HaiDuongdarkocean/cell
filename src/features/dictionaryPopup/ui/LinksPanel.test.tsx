import { describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import { LinksPanel } from './LinksPanel';
import type { ExternalDictLink } from '../types';

describe('LinksPanel', () => {
  it('renders an empty state when no links are provided', () => {
    render(<LinksPanel links={[]} />);

    const panel = screen.getByTestId('dictionary-links-panel');
    expect(within(panel).getByText('No external links')).toBeInTheDocument();
  });

  it('renders external links with safe target and rel attributes', () => {
    const links: ExternalDictLink[] = [
      { id: 'google', name: 'Google', url: 'https://google.com/search?q=hello' },
      { id: 'cambridge', name: 'Cambridge', url: 'https://dictionary.cambridge.org/dictionary/english/hello' },
    ];

    render(<LinksPanel links={links} />);

    const panel = screen.getByTestId('dictionary-links-panel');
    const google = within(panel).getByTestId('dictionary-link-google') as HTMLAnchorElement;
    expect(google).toHaveAttribute('href', 'https://google.com/search?q=hello');
    expect(google).toHaveAttribute('target', '_blank');
    expect(google).toHaveAttribute('rel', 'noopener noreferrer');
    expect(google).toHaveTextContent('Google');

    const cambridge = within(panel).getByTestId('dictionary-link-cambridge') as HTMLAnchorElement;
    expect(cambridge).toHaveAttribute('href', 'https://dictionary.cambridge.org/dictionary/english/hello');
    expect(cambridge).toHaveAttribute('target', '_blank');
    expect(cambridge).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
