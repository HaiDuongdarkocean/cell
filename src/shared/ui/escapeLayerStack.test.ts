import { fireEvent } from '@testing-library/react';
import { pushEscapeLayer } from './escapeLayerStack';

describe('escapeLayerStack', () => {
  it('invokes only the topmost layer on Escape, then the next one down', () => {
    const outer = jest.fn();
    const inner = jest.fn();
    const popOuter = pushEscapeLayer(outer);
    const popInner = pushEscapeLayer(inner);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    popInner();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(outer).toHaveBeenCalledTimes(1);

    popOuter();
  });

  it('consumes Escape in the capture phase so it never reaches the target', () => {
    const layer = jest.fn();
    const targetListener = jest.fn();
    const docBubbleListener = jest.fn();
    const el = document.createElement('div');
    document.body.appendChild(el);
    el.addEventListener('keydown', targetListener);
    document.addEventListener('keydown', docBubbleListener);
    const pop = pushEscapeLayer(layer);

    try {
      fireEvent.keyDown(el, { key: 'Escape' });
      expect(layer).toHaveBeenCalledTimes(1);
      expect(targetListener).not.toHaveBeenCalled();
      expect(docBubbleListener).not.toHaveBeenCalled();
    } finally {
      pop();
      document.body.removeChild(el);
      document.removeEventListener('keydown', docBubbleListener);
    }
  });

  it('lets Escape propagate normally once all layers are unregistered', () => {
    const listener = jest.fn();
    document.addEventListener('keydown', listener);
    const pop = pushEscapeLayer(jest.fn());
    pop();

    try {
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', listener);
    }
  });

  it('ignores non-Escape keys', () => {
    const layer = jest.fn();
    const pop = pushEscapeLayer(layer);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(layer).not.toHaveBeenCalled();
    pop();
  });
});
