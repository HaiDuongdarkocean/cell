import type { KeyboardEvent } from 'react';

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/**
 * APG radiogroup key nav for hand-assembled groups — Arrow/Home/End move focus
 * to the sibling [role="radio"] and activate it (selection follows focus).
 * Attach to the element with role="radiogroup"; ignored when the event target
 * is a nested interactive element (e.g. a menu button inside the radio).
 */
export function handleRadioGroupKeyDown(e: KeyboardEvent<HTMLElement>): void {
  if (!NAV_KEYS.has(e.key)) return;
  const target = e.target as HTMLElement;
  if (target.getAttribute('role') !== 'radio') return;
  e.preventDefault();
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
  const current = radios.indexOf(target);
  if (current < 0 || radios.length < 2) return;
  const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? radios.length - 1 : (current + dir + radios.length) % radios.length;
  radios[next].focus();
  radios[next].click();
}
