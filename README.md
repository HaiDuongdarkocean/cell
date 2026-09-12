# Cell — Chrome Extension for Video & Subtitle

Cell is a Manifest V3 Chrome extension that helps you download videos, detect/capture subtitles, and learn languages while you watch.

## Install from release (end user)

1. Download `cell.crx` from the [latest GitHub release](https://github.com/HaiDuongdarkocean/cell/releases/latest).
2. Open Chrome → `chrome://extensions/` → enable **Developer mode**.
3. Drag `cell.crx` onto the extensions page to install.

Chrome checks the extension against the `updates.xml` hosted in this repository and offers to update automatically when a newer release is available.

## Build from source

> **Note:** dictionary/language packs under `data/` and showcase sample videos are **not committed** (licensed third-party content, see `.gitignore`). They are only needed for dev-mode seeding and the design-system showcase — `npm run build` works without them.

```bash
git clone --depth=1 https://github.com/HaiDuongdarkocean/cell.git
cd cell

# Install dependencies
npm ci

# Build	npm run build
```

Build output goes into `dist/`. To pack it as a `.crx` with the auto-update manifest, see `npm run ship:dist` (requires the private signing key; see below).

## Repository layout

- `src/` — TypeScript/React source.
- `public/` — Runtime assets (ffmpeg, OCR models, sqlite WASM).
- `data/` — Dictionary and language-learning data (local only, gitignored — not shipped in the repo).
- `scripts/ship-dist.ps1` — Release pipeline: packs `dist/` into `.crx`, generates `updates.xml`, rotates Google Drive releases, and publishes a GitHub release when `scripts/ship.config.json` has `publishToGitHub: true`.
- `updates.xml` — Chrome extension update manifest (auto-committed at root).

## Release pipeline

```bash
npm run build
npm run ship:dist
```

This produces:

- `dist/`
- `cell.crx` (signed extension package)
- `updates.xml`
- `dist.zip`

### Private signing key

The CRX must be signed with the same private key for every release, otherwise the extension ID changes and Chrome treats it as a different extension.

- `cell-key.pem` is the expected key file at the repository root.
- It is **not** committed (see `.gitignore`).
- End users installing the pre-built `.crx` do **not** need the key.
- Do **not** generate a new key unless you are prepared to migrate to a new extension ID.

## Current release

- Repository: `https://github.com/HaiDuongdarkocean/cell`
- Update manifest: `https://raw.githubusercontent.com/HaiDuongdarkocean/cell/main/updates.xml`
- Latest release: `https://github.com/HaiDuongdarkocean/cell/releases/latest`

## Security

- Never commit `cell-key.pem` or other credentials.
- Report security issues privately to the repository owner.

## License

[Add your license here]
