"""
test-cell-browser.py — Cell extension loader via nodriver (stealth) + clone from master.

LEGACY / FALLBACK: This script uses CDP `loadUnpacked` which is session-only on
Chrome 137+ (closing Chrome drops the extension). The PRIMARY workflow is
`setup-cell-profile.py` (packs .crx + External Extensions JSON → MCP spawn
auto-loads, no debugging port). Use this script only when you need nodriver's
in-session CDP access for quick load verification.

Two modes:

1. `--url URL` (keep-alive): launch Chrome HEADED with extensions loaded via
   CDP `loadUnpacked`, navigate to URL, run a verify probe. Chrome stays open
   until Ctrl+C (or `--exit-after-verify`). WARNING: nodriver opens
   `--remote-debugging-port` — anti-bot sites may detect it. For anti-bot
   testing, use `setup-cell-profile.py` + MCP spawn instead.

2. Default (no --url): headless load-then-close. BROKEN on Chrome 137+ for
   MCP handoff (session-only extension is lost on close).

Usage:
  uv run --python 3.11 --with nodriver python -u .agents/skills/testing-extension-browser/script/test-cell-browser.py --url https://example.com --exit-after-verify
"""

import argparse
import asyncio
import atexit
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path

import nodriver as uc

# --- SSOT config ---
CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SESSION_ROOT = Path(r"C:\stealth-mcp-browser-sessions")
MASTER_PROFILE = SESSION_ROOT / "master"
SESSIONS_DIR = SESSION_ROOT / "sessions"
CELL_EXT = r"C:\Users\The0cean\Programming\The0cean ecosystem\cell\dist"
UBLOCK_EXT = r"C:\Users\The0cean\Programming\The0cean ecosystem\cell\data\extension\uBOLite"

# Files/dirs to copy from master (login + preferences only — exclude regenerable cache)
KEEP_PATTERNS = {
    "Default": {
        "Cookies", "Cookies-journal",
        "Login Data", "Login Data-journal",
        "Web Data", "Web Data-journal",
        "Preferences", "Secure Preferences",
        "Local Storage", "Session Storage",
        "Extension State",
    },
}
KEEP_ROOT_FILES = {"Local State", "First Party Sets", "first_party_sets.db"}


def clone_master() -> Path:
    """Clone essential files from master → sessions/<uuid>. Returns clone path."""
    clone_id = f"cell-{uuid.uuid4().hex[:12]}"
    clone_dir = SESSIONS_DIR / clone_id
    clone_dir.mkdir(parents=True, exist_ok=True)

    # Copy root-level files
    for fname in KEEP_ROOT_FILES:
        src = MASTER_PROFILE / fname
        if src.exists():
            shutil.copy2(src, clone_dir / fname)

    # Copy Default/ selectively
    src_default = MASTER_PROFILE / "Default"
    dst_default = clone_dir / "Default"
    dst_default.mkdir(exist_ok=True)

    if src_default.exists():
        for item in src_default.iterdir():
            if item.name in KEEP_PATTERNS["Default"]:
                if item.is_dir():
                    # Ignore LevelDB LOCK files — held by a running Chrome on the
                    # master profile (Permission denied) and never meaningful to clone.
                    shutil.copytree(item, dst_default / item.name, dirs_exist_ok=True, ignore=shutil.ignore_patterns("LOCK"))
                else:
                    shutil.copy2(item, dst_default / item.name)

    size_mb = sum(f.stat().st_size for f in clone_dir.rglob("*") if f.is_file()) / 1_000_000
    print(f"[OK] Cloned master → {clone_dir} ({size_mb:.1f} MB)", flush=True)
    return clone_dir


def cleanup_clone(clone_dir: Path) -> None:
    """Delete clone dir — retry up to 5x because Chrome holds file handles briefly after stop."""
    if not clone_dir.exists():
        return
    for attempt in range(5):
        try:
            shutil.rmtree(clone_dir)
            print(f"[OK] Cleaned up {clone_dir}", flush=True)
            return
        except (PermissionError, OSError):
            time.sleep(1)
    # Last resort: force remove
    shutil.rmtree(clone_dir, ignore_errors=True)
    if clone_dir.exists():
        print(f"[WARN] Could not fully remove {clone_dir} — Chrome still holding files", flush=True)
    else:
        print(f"[OK] Cleaned up {clone_dir} (forced)", flush=True)


async def load_extension(browser: uc.Browser, ext_path: str, name: str) -> str:
    """Load unpacked extension via CDP Extensions.loadUnpacked.
    Copies to a per-run temp dir to avoid _metadata race condition in parallel runs.
    Uses robocopy with /XF to skip filter-list .js files that Windows Defender
    may block with error 225 (false positive on easylist.js)."""
    src = Path(ext_path)
    # uBlock creates _metadata on load — Chrome rejects it. Copy to temp, strip _metadata.
    if (src / "_metadata").exists() or name == "uBlock":
        tmp = Path(os.environ.get("TEMP", "/tmp")) / f"cell-ext-{uuid.uuid4().hex[:8]}"
        if tmp.exists():
            shutil.rmtree(tmp, ignore_errors=True)
        # robocopy with /R:1 /W:1 (retry once, wait 1s) and /XF to skip blocked files.
        # Windows Defender false-positives on easylist.js cause error 225 / Errno 22.
        # uBlock still works without the scripting filter lists — they're optional.
        result = subprocess.run(
            [
                "robocopy", str(src), str(tmp),
                "/E", "/NFL", "/NDL", "/NP", "/NS", "/NC",
                "/R:1", "/W:1",
                "/XF", "easylist.js",
            ],
            shell=False,
            capture_output=True,
            timeout=30,
        )
        # robocopy exit code 0-7 is success, 8+ is failure
        if result.returncode >= 8:
            raise RuntimeError(f"robocopy failed (exit {result.returncode}): {result.stderr.decode(errors='replace')}")
        meta = tmp / "_metadata"
        if meta.exists():
            shutil.rmtree(meta, ignore_errors=True)
        ext_path = str(tmp)
    result = await browser.send(uc.cdp.extensions.load_unpacked(path=ext_path))
    ext_id = result if isinstance(result, str) else getattr(result, "id", str(result))
    print(f"[OK] {name} loaded: ID={ext_id}", flush=True)
    return ext_id


async def main() -> None:
    parser = argparse.ArgumentParser(description="Cell extension loader + tester (nodriver + clone). Launches Chrome with extensions loaded.")
    parser.add_argument("--no-ublock", action="store_true", help="Skip loading uBlock")
    parser.add_argument("--keep-profile", action="store_true", help="Don't delete clone on exit")
    parser.add_argument("--dev-build", action="store_true", help="Run `npx vite build --mode development` before launch (copies dictionary/frequency seed into dist/seed)")
    parser.add_argument("--url", default=None, help="Keep-alive mode: navigate to this URL and verify the extension is active in the live session (Chrome 137+ only working mode). Chrome stays open until Ctrl+C.")
    parser.add_argument("--headed", action="store_true", help="Force headed Chrome in legacy (no --url) mode. With --url, Chrome is always headed.")
    parser.add_argument("--exit-after-verify", action="store_true", help="With --url: close Chrome immediately after the verify probe prints (default: keep open until Ctrl+C).")
    parser.add_argument("--probe-deep", action="store_true", help="With --url: after the load probe, poll for <video> + #cell-subtitle-root shadow DOM (up to 40s) to verify the subtitle overlay mounted.")
    args = parser.parse_args()

    # --- 0. Build (optional) and verify extension paths ---
    project_root = Path(CELL_EXT).parent
    if args.dev_build:
        npx = shutil.which("npx") or shutil.which("npx.cmd")
        if not npx:
            print("[FAIL] `npx` not found in PATH — cannot run dev build.", flush=True)
            sys.exit(1)
        print(f"[..] Running dev build in {project_root} to seed dictionary/frequency assets...", flush=True)
        result = subprocess.run(
            [npx, "vite", "build", "--mode", "development"],
            cwd=project_root,
            shell=False,
        )
        if result.returncode != 0:
            print("[FAIL] Dev build failed.", flush=True)
            sys.exit(1)
        print("[OK] Dev build complete.", flush=True)
    if not Path(CELL_EXT).exists():
        print(f"[FAIL] Cell ext not found at {CELL_EXT} — run 'npm run build' first.", flush=True)
        sys.exit(1)
    load_ublock = not args.no_ublock and Path(UBLOCK_EXT).exists()
    if not args.no_ublock and not load_ublock:
        print(f"[WARN] uBlock not found at {UBLOCK_EXT} — skipping", flush=True)

    # --- 1. Clone master ---
    clone_dir = clone_master()

    # Register cleanup on any exit (graceful, signal, or crash)
    # atexit runs AFTER event loop closes, so cleanup_clone uses time.sleep (sync) not asyncio
    def _cleanup():
        if not args.keep_profile:
            cleanup_clone(clone_dir)
    atexit.register(_cleanup)

    # --- 2. Spawn browser with clone profile + anti-bot ---
    # --url mode is HEADED so the user sees the live session we keep open.
    # Legacy (no --url) stays headless unless --headed (it only loads then closes).
    keep_alive = args.url is not None
    headless = not (keep_alive or args.headed)
    mode = "headed" if not headless else "headless"
    print(f"[..] Launching Chrome ({mode}): profile={clone_dir}", flush=True)
    config = uc.Config(
        user_data_dir=str(clone_dir),
        headless=headless,
        lang="en-US",
        browser_executable_path=CHROME_EXE,
    )
    browser = await uc.start(config)
    print("[OK] Chrome launched (anti-bot: navigator.webdriver=false)", flush=True)

    # --- 3. Load extensions via CDP ---
    try:
        await load_extension(browser, CELL_EXT, "Cell (Video Downloader)")
        if load_ublock:
            await load_extension(browser, UBLOCK_EXT, "uBlock")
    except Exception as e:
        print(f"[FAIL] Extension load failed: {e}", flush=True)
        browser.stop()
        if not args.keep_profile:
            cleanup_clone(clone_dir)
        sys.exit(1)

    # --- 4. Branch: keep-alive verify (--url) vs legacy close (no --url) ---
    print(flush=True)
    print(f"Clone:  {clone_dir}", flush=True)
    print(f"Cell:   {CELL_EXT}", flush=True)
    if load_ublock:
        print(f"uBlock: {UBLOCK_EXT}", flush=True)
    print(flush=True)

    if keep_alive:
        # Keep-alive: navigate + verify IN this live session. The extension
        # is loaded only for this Chrome process (loadUnpacked is session-only
        # on Chrome 137+), so we must drive the SAME Chrome — no close+respawn.
        print(f"[..] Navigating to {args.url}", flush=True)
        tab = await browser.get(args.url, new_tab=False)
        # Wait for document.readyState 'complete' (content scripts inject at
        # document_start; fetchInterceptor patches window.fetch before page JS).
        try:
            await tab.wait_for("document.readyState === 'complete'", timeout=30)
        except Exception:
            pass
        probe = (
            "(() => {"
            " const f = window.fetch.toString();"
            " const fetchPatched = !f.includes('[native code]');"
            " const sub = document.querySelector('#cell-subtitle-root');"
            " const panel = document.querySelector('#cell-universal-panel-host');"
            " return JSON.stringify({"
            "  url: location.href,"
            "  readyState: document.readyState,"
            "  fetchPatched: fetchPatched,"
            "  fetchSource: f.slice(0, 120),"
            "  subtitleRoot: !!sub,"
            "  panelHost: !!panel"
            " });"
            "})()"
        )
        try:
            raw = await tab.evaluate(probe, await_promise=False)
        except Exception as e:
            print(f"[FAIL] verify probe threw: {e}", flush=True)
            raw = None
        # nodriver may return the string directly or as a CDP-serialized
        # {type,value} pair / list-of-pairs. Normalize to a plain string.
        res: dict | None = None
        if isinstance(raw, str):
            res = json.loads(raw)
        elif isinstance(raw, list):
            # list of [key, {type, value}] pairs -> decode
            decoded = {}
            for pair in raw:
                if isinstance(pair, list) and len(pair) == 2:
                    k, v = pair
                    decoded[k] = v.get("value") if isinstance(v, dict) else v
            res = decoded
        elif isinstance(raw, dict) and "value" in raw:
            res = json.loads(raw["value"])
        print(flush=True)
        print(f"[VERIFY] {res}", flush=True)
        # PASS contract: fetchInterceptor injected (MAIN-world content script ran)
        # OR a Cell shadow host is present. fetchPatched is the strongest signal
        # because fetchInterceptor runs at document_start on every <all_urls> page.
        if res and (res.get("fetchPatched") or res.get("subtitleRoot") or res.get("panelHost")):
            print("[PASS] Cell extension is active in the live session.", flush=True)
        else:
            print("[FAIL] Cell extension NOT active — content script did not inject.", flush=True)
        print(flush=True)

        # Deep probe: wait for <video> + #cell-subtitle-root shadow, then report
        # subtitle overlay state. Skipped on non-video pages (subtitleRoot false
        # is not a failure there). On video pages, the overlay mounts after the
        # video element is detected + a subtitle track is found.
        if args.probe_deep:
            print("[..] Deep probe: waiting for <video> + subtitle overlay (up to 40s)...", flush=True)
            deep_probe = (
                "(() => {"
                " const v = document.querySelector('video');"
                " const root = document.querySelector('#cell-subtitle-root');"
                " const sr = root?.shadowRoot;"
                " const target = sr?.querySelector('[data-role=target] span');"
                " const blocks = sr?.querySelectorAll('[data-role=cue-block]');"
                " return JSON.stringify({"
                "  hasVideo: !!v,"
                "  videoSrc: v?.currentSrc?.slice(0,80) || null,"
                "  videoReadyState: v?.readyState ?? null,"
                "  subtitleRoot: !!root,"
                "  subtitleShadow: !!sr,"
                "  shadowChildCount: sr?.children?.length ?? 0,"
                "  cueBlocks: blocks?.length ?? 0,"
                "  targetText: target?.textContent?.slice(0,60) || null"
                " });"
                "})()"
            )
            for attempt in range(8):
                await asyncio.sleep(5)
                try:
                    draw = await tab.evaluate(deep_probe, await_promise=False)
                except Exception as e:
                    print(f"[..] deep probe attempt {attempt+1} threw: {e}", flush=True)
                    continue
                dres: dict | None = None
                if isinstance(draw, str):
                    try: dres = json.loads(draw)
                    except Exception: dres = None
                elif isinstance(draw, list):
                    decoded = {}
                    for pair in draw:
                        if isinstance(pair, list) and len(pair) == 2:
                            k, v = pair
                            decoded[k] = v.get("value") if isinstance(v, dict) else v
                    dres = decoded
                elif isinstance(draw, dict) and "value" in draw:
                    try: dres = json.loads(draw["value"])
                    except Exception: dres = None
                print(f"[DEEP {attempt+1}/8] {dres}", flush=True)
                if dres and dres.get("subtitleShadow"):
                    print("[PASS] Subtitle overlay mounted in shadow DOM.", flush=True)
                    break
                if dres and not dres.get("hasVideo") and attempt >= 3:
                    print("[INFO] No <video> on this page — subtitle overlay not expected.", flush=True)
                    break
            else:
                print("[INFO] Subtitle overlay did not mount within 40s (may need play/seek).", flush=True)
            print(flush=True)
        if args.exit_after_verify:
            await _close_browser(browser)
        else:
            print("[..] Chrome kept open. Press Ctrl+C to close + cleanup clone.", flush=True)
            try:
                await asyncio.Event().wait()
            except (KeyboardInterrupt, asyncio.CancelledError):
                pass
            await _close_browser(browser)
        if not args.keep_profile:
            cleanup_clone(clone_dir)
        print("[OK] Done.", flush=True)
        return

    # Legacy: close Chrome so MCP can reuse the profile. NOTE: broken on Chrome
    # 137+ — loadUnpacked is session-only, closing Chrome drops the extension,
    # and MCP spawn_browser cannot re-load it (Preferences is not persisted).
    # Prefer `--url`. Kept for backward compatibility.
    print("[..] Closing Chrome so MCP can reuse the profile...", flush=True)
    await _close_browser(browser)
    print("[OK] Chrome closed. Profile ready for MCP.", flush=True)
    print(flush=True)
    print("Next: MCP spawn_browser + navigate.", flush=True)
    print(f'  spawn_browser(user_data_dir="{clone_dir}", headless=false)', flush=True)
    print(f'  navigate(url="https://...")', flush=True)
    print(flush=True)
    if not args.keep_profile:
        cleanup_clone(clone_dir)
    print("[OK] Done.", flush=True)


async def _close_browser(browser: uc.Browser) -> None:
    """Graceful Chrome shutdown: cdp.browser.close() lets Chrome flush state
    before exit. browser.stop() alone calls terminate() right after aclose(),
    racing the flush. Falls back to stop() if the CDP close fails."""
    try:
        await browser.send(uc.cdp.browser.close())
        for _ in range(10):
            if browser.stopped:
                break
            await asyncio.sleep(1)
    except Exception as e:
        print(f"[WARN] browser.close() failed: {e}, falling back to stop()", flush=True)
        browser.stop()
    time.sleep(2)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[..] Interrupted.", flush=True)
