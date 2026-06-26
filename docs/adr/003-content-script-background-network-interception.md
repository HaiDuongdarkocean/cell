# ADR-003: Content script for DOM scanning, background for network interception

## Context
Chrome extension needs to detect media (video/subtitle) from web pages. Two approaches: scan DOM in content script, or intercept network requests in background.

## Decision
Content script scans DOM for `<video>`, `<source>`, `<track>` elements. Background intercepts webRequest for HLS/subtitle URLs. Both layers communicate via messages.

## Rationale
- **DOM scanning**: Content script has direct access to DOM. Background cannot scan DOM (no DOM API in service worker). Video elements may be dynamically created by JS (not just in HTML).
- **Network interception**: Background can intercept all network requests (webRequest API). Content script cannot see network traffic. Some video sources are loaded via XHR/fetch, not just `<source>` tags.
- **Complementary**: DOM scanning catches JS-injected video elements. Network interception catches XHR/fetch sources. Both needed for complete coverage.
- **Performance**: Content script scan is lightweight (querySelector). Background interception is passive (listener). No performance issue.

## Consequences
- Positive: Complete media detection (DOM + network)
- Positive: Separation of concerns (DOM in content, network in background)
- Positive: Content script can send PAGE_SCAN_RESULT immediately (no need for background to wait for network)
- Negative: Two layers to maintain (content script + background)
- Negative: Message passing overhead (chrome.runtime.sendMessage)

## Alternatives Considered
- **Background-only (no content script)**: Cannot scan DOM. Would miss JS-injected video elements. Rejected.
- **Content script-only (no background)**: Cannot intercept network. Would miss XHR/fetch sources. Rejected.
- **DeclarativeNetRequest**: Can block/modify requests but cannot read response body. Needed for detecting subtitle content. Rejected.

## Status
Accepted. Implemented in `src/content/content-script.ts` (DOM scan) and `src/background/networkInterceptor.ts` (network interception).
