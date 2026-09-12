import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProfileMenu } from './ProfileMenu';
import type { ProfileMenuItem } from './ProfileMenu';

const ITEMS: ProfileMenuItem[] = [
  { key: 'edit', label: 'Edit', onSelect: jest.fn() },
  { key: 'delete', label: 'Delete', danger: true, onSelect: jest.fn() },
];

function renderInShadow(): { shadow: ShadowRoot; container: HTMLDivElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadow.appendChild(container);
  return { shadow, container };
}

// `within` works on any node with querySelector(All) — ShadowRoot qualifies,
// but its type isn't Element so it needs a cast.
const inShadow = (shadow: ShadowRoot) => within(shadow as unknown as HTMLElement);

describe('ProfileMenu', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the popover in light DOM and runs the selected action', () => {
    render(<ProfileMenu label="Profile actions" items={ITEMS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Profile actions' }));
    const menu = document.body.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(ITEMS[0].onSelect).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it('portals the menu inside the shadow root, not ownerDocument.body', () => {
    const { shadow, container } = renderInShadow();
    render(<ProfileMenu label="Profile actions" items={ITEMS} />, { container });
    fireEvent.click(inShadow(shadow).getByRole('button', { name: 'Profile actions' }));

    expect(shadow.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it('shadow DOM: item click still fires onSelect (mousedown does not pre-close)', () => {
    const { shadow, container } = renderInShadow();
    render(<ProfileMenu label="Profile actions" items={ITEMS} />, { container });
    fireEvent.click(inShadow(shadow).getByRole('button', { name: 'Profile actions' }));

    const item = shadow.querySelector<HTMLElement>('[role="menuitem"]');
    expect(item).not.toBeNull();
    // Real browsers dispatch mousedown before click — the outside-click
    // listener must see the real target inside the shadow root.
    fireEvent.mouseDown(item!);
    fireEvent.click(item!);
    expect(ITEMS[0].onSelect).toHaveBeenCalledTimes(1);
    expect(shadow.querySelector('[role="menu"]')).toBeNull();
  });

  it('shadow DOM: mousedown outside the menu closes it', () => {
    const { shadow, container } = renderInShadow();
    const outside = document.createElement('button');
    shadow.appendChild(outside);
    render(<ProfileMenu label="Profile actions" items={ITEMS} />, { container });
    fireEvent.click(inShadow(shadow).getByRole('button', { name: 'Profile actions' }));
    expect(shadow.querySelector('[role="menu"]')).not.toBeNull();

    fireEvent.mouseDown(outside);
    expect(shadow.querySelector('[role="menu"]')).toBeNull();
  });

  it('Escape closes the menu and returns focus to the trigger', () => {
    const { shadow, container } = renderInShadow();
    render(<ProfileMenu label="Profile actions" items={ITEMS} />, { container });
    const trigger = inShadow(shadow).getByRole('button', { name: 'Profile actions' });
    fireEvent.click(trigger);
    expect(shadow.querySelector('[role="menu"]')).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(shadow.querySelector('[role="menu"]')).toBeNull();
    expect(shadow.activeElement).toBe(trigger);
  });
});
