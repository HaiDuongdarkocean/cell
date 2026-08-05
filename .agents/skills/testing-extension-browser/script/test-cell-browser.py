"""
test-cell-browser.py — Cell extension loader via nodriver (stealth) + clone from master.

Workflow: clone master → spawn nodriver (anti-bot) → CDP loadUnpacked (Cell + uBlock)
→ close Chrome → MCP spawn_browser reuses profile (extensions auto-load from Preferences).

The script ONLY launches Chrome and loads extensions, then exits. Navigation, page
reload, and verification are handled by the MCP browser (stealth-chrome-devtools) which
spawns a new Chrome with the same user_data_dir — extensions auto-load from the profile.

Parallel-safe: each run gets unique clone dir. Auto-cleanup on exit.

Usage:
  uv run --python 3.11 --with nodriver python -u .agents/skills/testing-extension-browser/script/test-cell-browser.py
  uv run --python 3.11 --with nodriver python -u .agents/skills/testing-extension-browser/script/test-cell-browser.py --headless --no-ublock

After this script exits, use MCP with the printed Clone path:
  spawn_browser(user_data_dir="<Clone path>", headless=false, viewport_width=..., viewport_height=...)
  navigate(url="https://...")
"""

import argparse
import asyncio
import atexit
import os
import shutil
import signal
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
                    shutil.copytree(item, dst_default / item.name, dirs_exist_ok=True)
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
    Copies to a per-run temp dir to avoid _metadata race condition in parallel runs."""
    src = Path(ext_path)
    # uBlock creates _metadata on load — Chrome rejects it. Copy to temp, strip _metadata.
    if (src / "_metadata").exists() or name == "uBlock":
        tmp = Path(os.environ.get("TEMP", "/tmp")) / f"cell-ext-{uuid.uuid4().hex[:8]}"
        if tmp.exists():
            shutil.rmtree(tmp, ignore_errors=True)
        shutil.copytree(src, tmp, dirs_exist_ok=True)
        meta = tmp / "_metadata"
        if meta.exists():
            shutil.rmtree(meta, ignore_errors=True)
        ext_path = str(tmp)
    result = await browser.send(uc.cdp.extensions.load_unpacked(path=ext_path))
    ext_id = result if isinstance(result, str) else getattr(result, "id", str(result))
    print(f"[OK] {name} loaded: ID={ext_id}", flush=True)
    return ext_id


async def main() -> None:
    parser = argparse.ArgumentParser(description="Cell extension loader (nodriver + clone). Launches Chrome with extensions loaded — MCP handles navigation.")
    parser.add_argument("--headless", action="store_true", help="Run headless (no window)")
    parser.add_argument("--no-ublock", action="store_true", help="Skip loading uBlock")
    parser.add_argument("--keep-profile", action="store_true", help="Don't delete clone on exit")
    args = parser.parse_args()

    # --- 0. Verify extension paths ---
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
    print(f"[..] Launching Chrome: profile={clone_dir} headless={args.headless}", flush=True)
    config = uc.Config(
        user_data_dir=str(clone_dir),
        headless=args.headless,
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

    # --- 4. Close Chrome so MCP can reuse the profile without lock conflict ---
    # loadUnpacked writes extension to profile Preferences, so a new Chrome
    # launched by MCP spawn_browser with the same user_data_dir will auto-load
    # the extension. MCP handles all navigation + page interaction.
    print(flush=True)
    print(f"Clone:  {clone_dir}", flush=True)
    print(f"Cell:   {CELL_EXT}", flush=True)
    if load_ublock:
        print(f"uBlock: {UBLOCK_EXT}", flush=True)
    print(flush=True)
    print("[..] Closing Chrome so MCP can reuse the profile...", flush=True)
    browser.stop()
    time.sleep(2)
    print("[OK] Chrome closed. Profile ready for MCP.", flush=True)
    print(flush=True)
    print("Next: MCP spawn_browser + navigate.", flush=True)
    print(f'  spawn_browser(user_data_dir="{clone_dir}", headless=false)', flush=True)
    print(f'  navigate(url="https://...")', flush=True)
    print(flush=True)
    if not args.keep_profile:
        cleanup_clone(clone_dir)
    print("[OK] Done.", flush=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[..] Interrupted.", flush=True)
