# Tihoka Bridge — Anki add-on

Serves a localhost-only event feed so the Tihoka browser extension can mirror
Anki card state (new / learning / mature) into word statuses for immersion
tracking — near-realtime instead of waiting for the 5-minute poll.

## What it does

- Hooks review/edit events inside Anki.
- Appends `{cardId, kind, ts}` rows to `events.jsonl` (kept ≤ 7 days / 10k rows).
- Serves `GET http://127.0.0.1:8766/events?since=<cursor>` (JSON envelope
  `{cursor, events[]}`).
- Never leaves your machine: the server binds `127.0.0.1` only and is read-only.

## Install

1. Copy this folder into Anki's add-ons directory:
   - Windows: `%APPDATA%\Anki2\addons21\Tihoka-bridge\`
   - macOS: `~/Library/Application Support/Anki2/addons21/Tihoka-bridge/`
   - Linux: `~/.local/share/Anki2/addons21/Tihoka-bridge/`
   (Or Tools → Add-ons → "View Files", then create `Tihoka-bridge` and drop
   `__init__.py` + `config.json` in.)
2. Restart Anki.
3. In Tihoka → Settings → Sync → "Anki status sync", the bridge indicator turns
   **Connected**. The port field must match `config.json` (`port`, default 8766).

## Configure

`config.json`:

```json
{ "port": 8766 }
```

If another add-on already occupies 8766, pick a free port in `config.json` and
enter the same value in Tihoka's settings.

## Privacy

The feed lists card IDs and timestamps only — no card content, no deck names.
It answers GET requests from localhost; there is no write endpoint.

## Optional

The feature works without this add-on (periodic AnkiConnect polling). The
add-on just makes status updates propagate faster.
