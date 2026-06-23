import { PageScanner } from './pageScanner';

const scanner = new PageScanner();

// Helper function to get current tab ID
async function getCurrentTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// Scan on page load
const urls = scanner.scan();
if (urls.videoUrls.length > 0 || urls.subtitleUrls.length > 0) {
  getCurrentTabId().then((tabId) => {
    if (tabId !== undefined) {
      chrome.runtime.sendMessage({
        type: 'PAGE_SCAN_RESULT',
        payload: { 
          tabId, 
          videoUrls: urls.videoUrls, 
          subtitleUrls: urls.subtitleUrls 
        },
      });
    }
  });
}

// Start observing for dynamically loaded content
scanner.startObserving((newUrls) => {
  getCurrentTabId().then((tabId) => {
    if (tabId !== undefined) {
      chrome.runtime.sendMessage({
        type: 'PAGE_SCAN_RESULT',
        payload: { 
          tabId, 
          videoUrls: newUrls.videoUrls, 
          subtitleUrls: newUrls.subtitleUrls 
        },
      });
    }
  });
});
