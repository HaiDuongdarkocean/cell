import { render, fireEvent } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Menu, MenuItem } from './Menu';

function Harness(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef}>trigger</button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        ariaLabel="actions"
      >
        <MenuItem onSelect={() => {}}>Edit</MenuItem>
      </Menu>
    </>
  );
}

function renderInShadow(): { shadow: ShadowRoot; container: HTMLDivElement; host: HTMLDivElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadow.appendChild(container);
  return { shadow, container, host };
}

describe('Menu', () => {
  it('closes when a light-DOM ancestor scrolls', () => {
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    render(<Harness />, { container: scroller });

    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    fireEvent.scroll(scroller);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();

    scroller.remove();
  });

  it('shadow DOM: closes when an element inside the shadow root scrolls', () => {
    const { shadow, container, host } = renderInShadow();
    const scroller = document.createElement('div');
    shadow.appendChild(scroller);

    render(<Harness />, { container });
    expect(shadow.querySelector('[role="menu"]')).not.toBeNull();

    // scroll is non-composed — it stops at the shadow boundary, so a window
    // listener never sees it. The menu must listen on the trigger's root.
    fireEvent.scroll(scroller);
    expect(shadow.querySelector('[role="menu"]')).toBeNull();

    host.remove();
  });
});
