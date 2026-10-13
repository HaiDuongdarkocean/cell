# Tihoka Privacy Policy

Last updated: 2026-10-13

Tihoka is a browser extension that turns web content into study material:
video and subtitle download, dictionary lookup, Anki card creation, and
spaced-repetition study.

## Data storage

All study data (dictionaries, word status, cards, media cache, settings) is
stored **locally** in your browser profile: `chrome.storage`, IndexedDB, and
the Origin Private File System. Tihoka has no server of its own and sends no
telemetry or analytics anywhere.

## Network requests

The extension fetches resources only when you ask it to:

- Video and subtitle files from the page you are studying, so they can be
  downloaded or imported.
- Dictionary and translation resources you configure.
- Subtitle search providers (e.g. subdl.com) when you search subtitles.

## Optional Google Drive sync

If you choose to sign in, Tihoka uses Google OAuth
(`chrome.identity.launchWebAuthFlow`) with the scopes `drive.appdata`,
`drive.file`, `openid`, and `email` to sync your study data to a folder in
**your own** Google Drive. The sign-in is optional; the extension works fully
without it. Tihoka never sees or stores your Google password — authentication
is handled entirely by Google's consent page.

## Permissions

Broad permissions (`<all_urls>` host access, `webRequest`,
`declarativeNetRequest`) exist solely so the extension can detect and fetch
video/subtitle resources on whichever site you choose to study from. They are
not used to collect browsing history or track you across sites.

## Third parties

Tihoka does not sell, share, or transmit your data to any third party. The only
external services contacted are the ones you invoke: content sites you browse,
subtitle providers you search, and Google Drive if you enable sync.

## Contact

Repository: https://github.com/tihoka-official/tihoka
