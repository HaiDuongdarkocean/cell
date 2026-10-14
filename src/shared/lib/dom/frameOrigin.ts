export function isResolvableHttpOrigin(origin: string | null | undefined): origin is string {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Resolve the direct parent frame's origin for child→parent posts.
 *  ancestorOrigins[0] is browser-maintained and survives intra-iframe
 *  self-navigation (where document.referrer becomes the iframe's own URL).
 *  Returns undefined when unresolvable — callers must fail closed. */
export function resolveParentFrameOrigin(): string | undefined {
  try {
    const ancestor = window.location.ancestorOrigins?.[0];
    if (isResolvableHttpOrigin(ancestor)) return ancestor;
  } catch { /* cross-origin restrictions */ }
  try {
    const referrer = new URL(document.referrer).origin;
    if (isResolvableHttpOrigin(referrer)) return referrer;
  } catch { /* empty/invalid referrer */ }
  return undefined;
}

/** Resolve the TOP frame's origin — ancestorOrigins lists parent→top, so the
 *  last entry is the page the user sees. Player iframes key settings to the
 *  top site (onflix.lat), not the embed origin (playembed.vip). */
export function resolveTopFrameOrigin(): string | undefined {
  try {
    const origins = window.location.ancestorOrigins;
    const top = origins?.length ? origins[origins.length - 1] : undefined;
    if (isResolvableHttpOrigin(top)) return top;
  } catch { /* cross-origin restrictions */ }
  return resolveParentFrameOrigin();
}

/** Resolve an iframe element's src-derived origin for top→child posts.
 *  Returns undefined for src-less/about:blank/srcdoc/redirected iframes. */
export function resolveIframeOrigin(iframe: HTMLIFrameElement | null | undefined): string | undefined {
  try {
    const origin = iframe?.src ? new URL(iframe.src).origin : undefined;
    return isResolvableHttpOrigin(origin) ? origin : undefined;
  } catch {
    return undefined;
  }
}

/** True when `source` is the contentWindow of an iframe present in this document. */
export function isIframeContentWindow(source: Window | null): source is Window {
  if (!source) return false;
  const iframes = document.querySelectorAll('iframe');
  for (const f of iframes) {
    if (f.contentWindow === source) return true;
  }
  return false;
}
