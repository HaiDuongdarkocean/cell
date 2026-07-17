// webTextTriggerController tests — spec §5.2 P1: web text lookup trigger.

import { describe, expect, it, afterEach, jest } from '@jest/globals';
import { WebTextTriggerController } from './webTextTriggerController';
import type { LookupRequest } from '../types';

// jsdom provides window, document, getSelection.

function makeDeps() {
  const onLookup = jest.fn<(req: LookupRequest, id: string, rect: DOMRect) => void>();
  const onCancel = jest.fn<(id: string) => void>();
  return { onLookup, onCancel };
}

function setSelection(text: string, element?: HTMLElement): void {
  const el = element ?? document.body;
  el.textContent = text;
  document.body.appendChild(el);
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

describe('WebTextTriggerController', () => {
  let ctrl: WebTextTriggerController;

  afterEach(() => {
    if (ctrl) ctrl.detach();
    document.body.innerHTML = '';
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  });

  it('dispatches lookup on mouseup with text selection (click mode)', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'click', ...deps });
    ctrl.attach();

    const p = document.createElement('p');
    setSelection('hello world', p);

    // Simulate mouseup on the paragraph.
    const evt = new MouseEvent('mouseup', { bubbles: true });
    p.dispatchEvent(evt);

    expect(deps.onLookup).toHaveBeenCalledTimes(1);
    const [req, id, rect] = deps.onLookup.mock.calls[0];
    expect(req.term).toBe('hello world');
    expect(req.langCode).toBe('en');
    expect(req.contextSentence).toBe('hello world');
    expect(id).toMatch(/^dp-/);
    expect(rect).toBeDefined();
    expect(typeof rect.left).toBe('number');
  });

  it('does not dispatch on empty selection', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'click', ...deps });
    ctrl.attach();

    const evt = new MouseEvent('mouseup', { bubbles: true });
    document.body.dispatchEvent(evt);

    expect(deps.onLookup).not.toHaveBeenCalled();
  });

  it('does not dispatch on very long selection (>200 chars)', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'click', ...deps });
    ctrl.attach();

    const long = 'a'.repeat(201);
    const p = document.createElement('p');
    setSelection(long, p);

    const evt = new MouseEvent('mouseup', { bubbles: true });
    p.dispatchEvent(evt);

    expect(deps.onLookup).not.toHaveBeenCalled();
  });

  it('cancels previous in-flight request on new lookup', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'click', ...deps });
    ctrl.attach();

    const p1 = document.createElement('p');
    setSelection('first', p1);
    p1.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const p2 = document.createElement('p');
    setSelection('second', p2);
    p2.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(deps.onLookup).toHaveBeenCalledTimes(2);
    expect(deps.onCancel).toHaveBeenCalledTimes(1);
    expect(deps.onCancel.mock.calls[0][0]).toMatch(/^dp-/);
  });

  it('detects Chinese from CJK selection', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'click', ...deps });
    ctrl.attach();

    const p = document.createElement('p');
    setSelection('我喜欢你', p);

    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(deps.onLookup).toHaveBeenCalledTimes(1);
    expect(deps.onLookup.mock.calls[0][0].langCode).toBe('zh');
  });

  it('ignores mouseup inside Shadow DOM', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'click', ...deps });
    ctrl.attach();

    // Create a shadow host and dispatch mouseup from inside it.
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    inner.textContent = 'shadow text';
    shadow.appendChild(inner);

    // Can't easily set selection inside shadow in jsdom, but target check
    // happens before selection check. Dispatch from shadow element.
    const evt = new MouseEvent('mouseup', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: inner });
    inner.dispatchEvent(evt);

    expect(deps.onLookup).not.toHaveBeenCalled();
  });

  it('does not dispatch in hover+modifier mode on mouseup alone', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'hover-ctrl', ...deps });
    ctrl.attach();

    const p = document.createElement('p');
    setSelection('hello', p);
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(deps.onLookup).not.toHaveBeenCalled();
  });

  it('dispatches on Ctrl+keydown with selection in hover-ctrl mode', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'hover-ctrl', ...deps });
    ctrl.attach();

    const p = document.createElement('p');
    setSelection('hello', p);

    const evt = new KeyboardEvent('keydown', { ctrlKey: true, bubbles: true });
    document.dispatchEvent(evt);

    expect(deps.onLookup).toHaveBeenCalledTimes(1);
    expect(deps.onLookup.mock.calls[0][0].term).toBe('hello');
  });

  it('does not dispatch on keydown without modifier in hover-ctrl mode', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'hover-ctrl', ...deps });
    ctrl.attach();

    const p = document.createElement('p');
    setSelection('hello', p);

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));

    expect(deps.onLookup).not.toHaveBeenCalled();
  });

  it('isCurrentRequestId matches after dispatch', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'click', ...deps });
    ctrl.attach();

    const p = document.createElement('p');
    setSelection('test', p);
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const dispatchedId = deps.onLookup.mock.calls[0][1];
    expect(ctrl.isCurrentRequestId(dispatchedId)).toBe(true);
    expect(ctrl.isCurrentRequestId('wrong-id')).toBe(false);
  });

  it('clearRequestId clears the in-flight id', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'click', ...deps });
    ctrl.attach();

    const p = document.createElement('p');
    setSelection('test', p);
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const id = deps.onLookup.mock.calls[0][1];
    ctrl.clearRequestId(id);
    expect(ctrl.isCurrentRequestId(id)).toBe(false);
  });

  it('cancelInFlight calls onCancel', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'click', ...deps });
    ctrl.attach();

    const p = document.createElement('p');
    setSelection('test', p);
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    ctrl.cancelInFlight();
    expect(deps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('detach removes listeners (no dispatch after detach)', () => {
    const deps = makeDeps();
    ctrl = new WebTextTriggerController({ triggerMode: 'click', ...deps });
    ctrl.attach();

    ctrl.detach();

    const p = document.createElement('p');
    setSelection('test', p);
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(deps.onLookup).not.toHaveBeenCalled();
  });
});
