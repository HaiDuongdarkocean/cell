"""Tihoka Bridge — Anki add-on.

Watches card state changes (reviews, edits, suspend toggles) and serves a
cursor-based event feed on http://127.0.0.1:<port>/events?since=<cursor>
for the Tihoka browser extension's anki-status-sync feature.

Events are appended to events.jsonl next to this file (max 10k rows or
7 days, whichever bound is hit first). The feed is read-only and bound to
localhost only.
"""

import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ADDON_DIR = os.path.dirname(os.path.abspath(__file__))
EVENTS_PATH = os.path.join(ADDON_DIR, "events.jsonl")
CONFIG_PATH = os.path.join(ADDON_DIR, "config.json")

DEFAULT_PORT = 8766
MAX_EVENTS = 10_000
MAX_AGE_S = 7 * 24 * 60 * 60

_lock = threading.Lock()
_cursor = 0


def _load_config() -> dict:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
            cfg = json.load(fh)
            if isinstance(cfg, dict):
                return cfg
    except (OSError, ValueError):
        pass
    return {}


def _append_event(card_id: int, kind: str) -> None:
    global _cursor
    row = {"cursor": _cursor, "cardId": card_id, "kind": kind, "ts": int(time.time() * 1000)}
    with _lock:
        try:
            with open(EVENTS_PATH, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(row) + "\n")
            _cursor += 1
            _trim_events()
        except OSError:
            pass


def _trim_events() -> None:
    try:
        with open(EVENTS_PATH, "r", encoding="utf-8") as fh:
            lines = fh.readlines()
    except OSError:
        return
    cutoff = int(time.time() * 1000) - MAX_AGE_S * 1000
    kept = []
    for line in lines:
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if isinstance(row, dict) and row.get("ts", 0) >= cutoff:
            kept.append(line)
    if len(kept) > MAX_EVENTS:
        kept = kept[-MAX_EVENTS:]
    if len(kept) != len(lines):
        with open(EVENTS_PATH, "w", encoding="utf-8") as fh:
            fh.writelines(kept)


def _read_events(since: int) -> list:
    events = []
    last_cursor = since
    try:
        with open(EVENTS_PATH, "r", encoding="utf-8") as fh:
            for line in fh:
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(row, dict):
                    continue
                cursor = row.get("cursor")
                if not isinstance(cursor, int) or cursor <= since:
                    continue
                events.append({"cardId": row.get("cardId"), "kind": row.get("kind"), "ts": row.get("ts")})
                last_cursor = cursor
    except OSError:
        pass
    return events, last_cursor


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 — stdlib naming
        parsed = urlparse(self.path)
        if parsed.path != "/events":
            self.send_error(404)
            return
        qs = parse_qs(parsed.query)
        try:
            since = int(qs.get("since", ["0"])[0])
        except ValueError:
            since = 0
        with _lock:
            events, cursor = _read_events(since)
        body = json.dumps({"cursor": cursor, "events": events}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # keep Anki console quiet
        pass


def _serve(port: int) -> None:
    server = ThreadingHTTPServer(("127.0.0.1", port), _Handler)
    server.daemon_threads = True
    server.serve_forever()


def _watch_card(card, kind: str = "edit") -> None:
    card_id = getattr(card, "id", None)
    if isinstance(card_id, int) and card_id:
        _append_event(card_id, kind)


def _register_hooks() -> None:
    from aqt import gui_hooks

    def on_answer(card, _ease, _replay=None):
        _watch_card(card, "review")

    def on_card_flush(card, *_args):
        _watch_card(card, "edit")

    hooks = [
        ("reviewer_did_answer_card", on_answer),
        ("card_will_flush", on_card_flush),
        ("reviewer_did_show_answer", lambda card: _watch_card(card, "show")),
    ]
    for name, fn in hooks:
        hook = getattr(gui_hooks, name, None)
        if hook is not None:
            hook.append(fn)


def _on_startup() -> None:
    port = int(_load_config().get("port", DEFAULT_PORT))
    try:
        _register_hooks()
    except Exception:
        pass
    thread = threading.Thread(target=_serve, args=(port,), daemon=True)
    thread.start()


try:
    from aqt import gui_hooks

    gui_hooks.main_window_did_init.append(_on_startup)
except Exception:
    _on_startup()
