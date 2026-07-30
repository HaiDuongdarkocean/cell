import { render, screen } from '@testing-library/react';
import { WordTitle } from './WordTitle';

describe('WordTitle', () => {
  it('renders the word text', () => {
    render(<WordTitle>serendipity</WordTitle>);
    expect(screen.getByText('serendipity')).toBeInTheDocument();
  });

  it('renders an h2 by default', () => {
    const { container } = render(<WordTitle>hello</WordTitle>);
    expect(container.querySelector('h2')).not.toBeNull();
  });

  it('renders h1 when level=1', () => {
    const { container } = render(<WordTitle level={1}>hello</WordTitle>);
    expect(container.querySelector('h1')).not.toBeNull();
  });

  it('renders h3 when level=3', () => {
    const { container } = render(<WordTitle level={3}>hello</WordTitle>);
    expect(container.querySelector('h3')).not.toBeNull();
  });

  it('renders inline phonetic when provided', () => {
    render(<WordTitle phonetic="/ˌserənˈdɪpəti/">serendipity</WordTitle>);
    expect(screen.getByText('/ˌserənˈdɪpəti/')).toBeInTheDocument();
  });

  it('applies the provided id', () => {
    const { container } = render(<WordTitle id="word-1">hello</WordTitle>);
    expect(container.querySelector('#word-1')).not.toBeNull();
  });

  it('merges custom className', () => {
    const { container } = render(<WordTitle className="extra">hello</WordTitle>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
