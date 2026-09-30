"""
stealth-cell-browser.py — launch real Chrome via nodriver (undetected) with
Cell + uBOLite session-loaded through CDP Extensions.loadUnpacked.

Why not --load-extension: Google Chrome 137+ blocks it; Playwright Chromium
loads it fine but gets bot-flagged by YouTube (playability=LOGIN_REQUIRED).
nodriver drives the installed Chrome binary, and CDP Extensions.loadUnpacked
bypasses the flag block (session-only, gone on next launch).

Usage:
    uv run --with nodriver python <your-script>.py
    from stealth_cell_browser import launch, ev, gate_extension
"""
import json
from pathlib import Path

import nodriver as uc

REPO_ROOT = Path(__file__).resolve().parents[4]
CELL_DIST = REPO_ROOT / "dist"
UBOLITE = REPO_ROOT / "data" / "extension" / "uBOLite"


async def ev(tab, js):
    """Evaluate a JS expression, returning a Python value.

    nodriver's evaluate() does NOT await promises and returns CDP-shaped
    results ([[key, {type, value}], ...]); JSON.stringify + normalize handles
    both. For async work: stash into window.__r_x, poll with ev() until non-None
    (inline <script> injection is CSP-blocked — evaluate() itself is not).
    """
    r = await tab.evaluate(f"JSON.stringify({js})")
    if isinstance(r, list):
        r = r[0][1].get("value") if r else None
    elif isinstance(r, dict):
        r = r.get("value")
    return json.loads(r) if isinstance(r, str) else r


async def launch(headless=False, urls=("chrome://newtab/",)):
    """Start stealth Chrome, session-load Cell + uBOLite, open urls.
    Returns (browser, tab | [tabs])."""
    cfg = uc.Config(headless=headless)
    browser = await uc.start(cfg)
    for p in (CELL_DIST, UBOLITE):
        try:
            res = await browser.send(uc.cdp.extensions.load_unpacked(str(p)))
            print("LOAD:", p.name, "->", res)
        except Exception as e:  # transient icon-load errors happen; retry once
            print("LOAD retry:", p.name, "->", e)
            res = await browser.send(uc.cdp.extensions.load_unpacked(str(p)))
            print("LOAD:", p.name, "->", res)
    tabs = [await browser.get(u) for u in urls]
    return browser, (tabs[0] if len(tabs) == 1 else tabs)


async def gate_extension(tab, required=True):
    """Contract gate: Cell main-world IIFE set __YT_MAIN_WORLD_INJECTED.
    xhrPatched/fetchPatched toString() checks are UNRELIABLE — uBOLite re-wraps
    after document_start while still calling ours underneath."""
    g = await ev(tab, "({i:!!window.__YT_MAIN_WORLD_INJECTED})")
    ok = bool(g and g.get("i"))
    print("GATE:", json.dumps(g))
    if required and not ok:
        raise RuntimeError("Cell main-world script not injected")
    return ok
