import { getFixedContainingBlock } from './getFixedContainingBlock';

function createHost(): HTMLDivElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

function withShadowRoot(host: HTMLDivElement): { shadowRoot: ShadowRoot; inner: HTMLDivElement } {
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const inner = document.createElement('div');
  shadowRoot.appendChild(inner);
  return { shadowRoot, inner };
}

describe('getFixedContainingBlock', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when no ancestor establishes a fixed containing block', () => {
    const host = createHost();
    const { inner } = withShadowRoot(host);
    const target = document.createElement('span');
    inner.appendChild(target);

    expect(getFixedContainingBlock(target)).toBeNull();
  });

  it('detects a transformed shadow host as the containing block', () => {
    const host = createHost();
    host.style.transform = 'translateX(100px)';
    const { inner } = withShadowRoot(host);
    const target = document.createElement('span');
    inner.appendChild(target);

    expect(getFixedContainingBlock(target)).toBe(host);
  });

  it('skips display: contents ancestors and stops at the nearest real box', () => {
    const host = createHost();
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents';
    wrapper.style.transform = 'translateX(100px)';
    host.appendChild(wrapper);
    const target = document.createElement('span');
    wrapper.appendChild(target);

    expect(getFixedContainingBlock(target)).toBeNull();

    host.style.transform = 'translateY(10px)';
    expect(getFixedContainingBlock(target)).toBe(host);
  });

  it('detects fixed containing blocks from each relevant property', () => {
    const cases: { prop: string; value: string }[] = [
      { prop: 'transform', value: 'translateX(1px)' },
      { prop: 'filter', value: 'blur(1px)' },
      { prop: 'perspective', value: '1000px' },
      { prop: 'contain', value: 'layout' },
      { prop: 'contain', value: 'paint' },
      { prop: 'contain', value: 'strict' },
      { prop: 'contain', value: 'content' },
      { prop: 'contain', value: 'layout size' },
      { prop: 'willChange', value: 'transform' },
      { prop: 'willChange', value: 'filter' },
      { prop: 'willChange', value: 'perspective' },
    ];

    for (const { prop, value } of cases) {
      const host = createHost();
      (host.style as unknown as Record<string, string>)[prop] = value;
      const { inner } = withShadowRoot(host);
      const target = document.createElement('span');
      inner.appendChild(target);

      expect(getFixedContainingBlock(target)).toBe(host);

      document.body.innerHTML = '';
    }
  });

  it('does not treat size-only contain as a fixed containing block', () => {
    const host = createHost();
    host.style.contain = 'size';
    const { inner } = withShadowRoot(host);
    const target = document.createElement('span');
    inner.appendChild(target);

    expect(getFixedContainingBlock(target)).toBeNull();
  });

  it('does not treat the document root as a fixed containing block', () => {
    const target = document.createElement('span');
    document.body.appendChild(target);
    document.documentElement.style.transform = 'translateX(1px)';

    expect(getFixedContainingBlock(target)).toBeNull();

    document.documentElement.style.transform = '';
  });

  it('treats a slotted element\'s assigned slot as the flat-tree parent', () => {
    const host = createHost();
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const slot = document.createElement('slot');
    slot.setAttribute('name', 'item');
    slot.style.transform = 'translateX(100px)';
    shadowRoot.appendChild(slot);

    const target = document.createElement('span');
    target.slot = 'item';
    host.appendChild(target);

    expect(getFixedContainingBlock(target)).toBe(slot);
  });
});
