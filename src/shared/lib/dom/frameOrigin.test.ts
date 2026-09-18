import { describe, expect, it, afterEach } from '@jest/globals';
import {
  isResolvableHttpOrigin,
  resolveParentFrameOrigin,
  resolveIframeOrigin,
} from './frameOrigin';

function setAncestorOrigins(origins: string[] | undefined): void {
  Object.defineProperty(window.location, 'ancestorOrigins', {
    value: origins,
    configurable: true,
  });
}

function setReferrer(referrer: string): void {
  Object.defineProperty(document, 'referrer', {
    value: referrer,
    configurable: true,
  });
}

afterEach(() => {
  setAncestorOrigins(undefined);
  setReferrer('');
});

describe('isResolvableHttpOrigin', () => {
  it('accepts http and https origins', () => {
    expect(isResolvableHttpOrigin('https://player.example')).toBe(true);
    expect(isResolvableHttpOrigin('http://localhost:8080')).toBe(true);
  });

  it('rejects opaque, null, empty and non-http origins', () => {
    for (const o of ['null', '', 'about:blank', 'javascript:alert(1)', 'blob:https://x/1', 'data:text/html,x']) {
      expect(isResolvableHttpOrigin(o)).toBe(false);
    }
    expect(isResolvableHttpOrigin(null)).toBe(false);
    expect(isResolvableHttpOrigin(undefined)).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isResolvableHttpOrigin('not a url')).toBe(false);
    expect(isResolvableHttpOrigin('example.com')).toBe(false);
  });
});

describe('resolveParentFrameOrigin', () => {
  it('prefers location.ancestorOrigins[0]', () => {
    setAncestorOrigins(['https://parent.example']);
    setReferrer('https://other.example/page');
    expect(resolveParentFrameOrigin()).toBe('https://parent.example');
  });

  it('falls back to document.referrer origin', () => {
    setAncestorOrigins(undefined);
    setReferrer('https://parent.example/some/path?q=1');
    expect(resolveParentFrameOrigin()).toBe('https://parent.example');
  });

  it('skips a non-http ancestor and uses the referrer', () => {
    setAncestorOrigins(['null']);
    setReferrer('https://parent.example/');
    expect(resolveParentFrameOrigin()).toBe('https://parent.example');
  });

  it('returns undefined when neither source resolves', () => {
    setAncestorOrigins(undefined);
    setReferrer('');
    expect(resolveParentFrameOrigin()).toBeUndefined();
  });
});

describe('resolveIframeOrigin', () => {
  it('resolves the origin from iframe.src', () => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://player.example/embed/abc?x=1#frag';
    expect(resolveIframeOrigin(iframe)).toBe('https://player.example');
  });

  it('returns undefined for src-less or non-http iframes', () => {
    const noSrc = document.createElement('iframe');
    expect(resolveIframeOrigin(noSrc)).toBeUndefined();
    expect(resolveIframeOrigin(null)).toBeUndefined();
    const about = document.createElement('iframe');
    about.src = 'about:blank';
    expect(resolveIframeOrigin(about)).toBeUndefined();
  });
});
