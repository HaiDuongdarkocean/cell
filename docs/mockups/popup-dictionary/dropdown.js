/* ============================================================
   dropdown.js — custom YouTube-style dropdown
   Trigger: pill button (18px) + chevron. Menu: popup (12px),
   items 40px, hover fill, selected primary subtle.
   Keyboard: Enter/Space open, Arrow up/down navigate, Enter select,
   Esc close, outside click closes.
   ============================================================ */

import { iconStr } from './icons.js';

/**
 * Build a custom dropdown.
 * @param {Object} opts
 * @param {string} opts.ariaLabel       — a11y label
 * @param {Array<{value:string,label:string}>} opts.options
 * @param {string} opts.value           — current value
 * @param {(value:string)=>void} opts.onChange
 * @param {string} [opts.placeholder]   — shown when value not in options
 * @param {boolean} [opts.disabled]
 * @param {string} [opts.width]         — CSS width for trigger
 * @returns {HTMLElement} root element (.dropdown)
 */
export function createDropdown({ ariaLabel, options, value, onChange, placeholder = 'Select', disabled = false, width }) {
  const root = document.createElement('div');
  root.className = 'dropdown';
  if (disabled) root.classList.add('is-disabled');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'dropdown__trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', ariaLabel);
  if (width) trigger.style.width = width;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'dropdown__label';
  const current = options.find((o) => o.value === value);
  labelSpan.textContent = current ? current.label : placeholder;
  trigger.appendChild(labelSpan);

  const chevron = document.createElement('span');
  chevron.className = 'dropdown__chevron';
  chevron.innerHTML = iconStr('chevronDown', 18);
  trigger.appendChild(chevron);

  const menu = document.createElement('ul');
  menu.className = 'dropdown__menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', ariaLabel);

  let activeIndex = options.findIndex((o) => o.value === value);

  function renderItems() {
    menu.innerHTML = '';
    options.forEach((o, i) => {
      const li = document.createElement('li');
      li.className = 'dropdown__item';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(o.value === value));
      li.dataset.value = o.value;
      li.textContent = o.label;
      if (o.value === value) li.classList.add('is-selected');
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        select(o.value);
      });
      li.addEventListener('mouseenter', () => { activeIndex = i; updateActive(); });
      menu.appendChild(li);
    });
  }

  function select(v) {
    const opt = options.find((o) => o.value === v);
    if (!opt) return;
    labelSpan.textContent = opt.label;
    activeIndex = options.indexOf(opt);
    close();
    onChange?.(v);
  }

  function updateActive() {
    menu.querySelectorAll('.dropdown__item').forEach((li, i) => {
      li.classList.toggle('is-active', i === activeIndex);
    });
  }

  function open() {
    if (disabled) return;
    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    renderItems();
    updateActive();
    // scroll active into view
    const activeEl = menu.querySelectorAll('.dropdown__item')[activeIndex];
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    // focus first/active item
    setTimeout(() => {
      const items = menu.querySelectorAll('.dropdown__item');
      if (items[activeIndex]) items[activeIndex].focus();
    }, 0);
    document.addEventListener('mousedown', onOutside, true);
  }

  function close() {
    root.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside, true);
  }

  function onOutside(e) {
    if (!root.contains(e.target)) close();
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (root.classList.contains('is-open')) close();
    else open();
  });

  root.addEventListener('keydown', (e) => {
    const items = menu.querySelectorAll('.dropdown__item');
    if (root.classList.contains('is-open')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % options.length;
        updateActive();
        items[activeIndex]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + options.length) % options.length;
        updateActive();
        items[activeIndex]?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const focused = document.activeElement;
        if (focused && focused.classList.contains('dropdown__item')) {
          select(focused.dataset.value);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
        trigger.focus();
      }
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      open();
    }
  });

  renderItems();
  root.appendChild(trigger);
  root.appendChild(menu);
  return root;
}
