import { describe, expect, it, afterEach } from '@jest/globals';
import { setIframeVideo, iframeHasVideo, hasIframeVideo } from './iframeVideoRegistry';

function makeIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  return iframe;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('iframeVideoRegistry', () => {
  it('reports true after a child iframe announces a video', () => {
    const iframe = makeIframe();
    setIframeVideo(iframe, true);
    expect(iframeHasVideo(iframe)).toBe(true);
    expect(hasIframeVideo()).toBe(true);
    setIframeVideo(iframe, false);
  });

  it('reports false after the iframe announces absence', () => {
    const iframe = makeIframe();
    setIframeVideo(iframe, true);
    setIframeVideo(iframe, false);
    expect(hasIframeVideo()).toBe(false);
  });

  it('prunes iframes removed from the document', () => {
    const iframe = makeIframe();
    setIframeVideo(iframe, true);
    iframe.remove();
    expect(hasIframeVideo()).toBe(false);
  });

  it('tracks multiple iframes independently', () => {
    const a = makeIframe();
    const b = makeIframe();
    setIframeVideo(a, true);
    setIframeVideo(b, true);
    setIframeVideo(a, false);
    expect(hasIframeVideo()).toBe(true);
    expect(iframeHasVideo(b)).toBe(true);
    setIframeVideo(b, false);
  });
});
