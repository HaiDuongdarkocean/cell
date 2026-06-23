import { PageScanner } from './pageScanner';

const scanner = new PageScanner();

// Scan on page load
const urls = scanner.scan();
if (urls.videoUrls.length > 0 || urls.subtitleUrls.length > 0) {
  chrome.runtime.sendMessage({
    type: 'PAGE_SCAN_RESULT',
    payload: { videoUrls: urls.videoUrls, subtitleUrls: urls.subtitleUrls },
  });
}

// Start observing for dynamically loaded content
scanner.startObserving((newUrls) => {
  chrome.runtime.sendMessage({
    type: 'PAGE_SCAN_RESULT',
    payload: { videoUrls: newUrls.videoUrls, subtitleUrls: newUrls.subtitleUrls },
  });
});
