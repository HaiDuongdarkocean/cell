// Video/track/source discovery that pierces open Shadow DOM.
//
// Players increasingly wrap <video> inside custom elements with open shadow
// roots (e.g. vidstack, custom React players). document.querySelector('video')
// misses those elements, so the overlay never inits and auto-load never fires.
//
// Caveat: closed shadow roots (mode 'closed') are intentionally inaccessible;
// this helper cannot find them.

function collectInRoot<T extends Element>(
  root: Document | ShadowRoot | Element,
  selector: string,
): T[] {
  const found: T[] = Array.from(root.querySelectorAll(selector));

  // Use a TreeWalker to find every element that hosts an open shadow root.
  // querySelectorAll does not pierce shadow boundaries, so we recursively
  // descend each discovered shadow root.
  const doc = root.ownerDocument ?? (root instanceof Document ? root : document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  while (node) {
    const el = node as Element;
    if (el.shadowRoot) {
      found.push(...collectInRoot<T>(el.shadowRoot, selector));
    }
    node = walker.nextNode();
  }
  return found;
}

/** Return every matching element in `root` and its open shadow roots.
 * Defaults to the current document. */
export function queryAllShadow<T extends Element = Element>(
  selector: string,
  root: Document | ShadowRoot | Element = document,
): T[] {
  return collectInRoot<T>(root, selector);
}

function collectVideos(): HTMLVideoElement[] {
  return queryAllShadow<HTMLVideoElement>('video');
}

/** True when the page has a video element with a non-zero bounding rect. */
export function hasVisibleVideo(): boolean {
  return findLargestPlayableVideo() !== null;
}

/** Find the largest <video> with a non-zero bounding rect, piercing open shadow roots. */
export function findLargestPlayableVideo(): HTMLVideoElement | null {
  const videos = collectVideos().filter((v) => {
    const rect = v.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  if (videos.length === 0) return null;

  videos.sort((a, b) => {
    // Prefer videos with loaded metadata (videoWidth > 0) — they're the real
    // playable target. Fall back to bounding-rect area when no video has
    // loaded yet (CDN still fetching) so we pick the visually largest one.
    const aMeta = a.videoWidth * a.videoHeight;
    const bMeta = b.videoWidth * b.videoHeight;
    if (aMeta > 0 || bMeta > 0) return bMeta - aMeta;
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    return (bRect.width * bRect.height) - (aRect.width * aRect.height);
  });

  return videos[0] ?? null;
}

/** Return every <video> in the current document and its open shadow roots. */
export function getAllVideos(): HTMLVideoElement[] {
  return collectVideos();
}

/** Return the first video found, or null. */
export function getFirstVideo(): HTMLVideoElement | null {
  return collectVideos()[0] ?? null;
}

/** True if the given video is still present in the document or a shadow root. */
export function hasVideo(video: HTMLVideoElement): boolean {
  return collectVideos().includes(video);
}
