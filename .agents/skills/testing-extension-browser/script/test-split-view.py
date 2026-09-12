"""test-split-view.py — Load Cell extension only (nodriver stealth). MCP handles navigation + test.

Usage:
  uv run --python 3.11 --with nodriver python -u .agents/skills/testing-extension-browser/script/test-split-view.py --keep-profile
  # Then MCP: spawn_browser(user_data_dir="<clone path>", headless=false) + navigate(url=...)
"""
import argparse
import asyncio
import atexit
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
CELL_EXT = str(Path(__file__).resolve().parents[4] / "dist")
UBLOCK_EXT = str(Path(__file__).resolve().parents[4] / "data" / "extension" / "uBOLite")

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
    clone_id = f"cell-{uuid.uuid4().hex[:12]}"
    clone_dir = SESSIONS_DIR / clone_id
    clone_dir.mkdir(parents=True, exist_ok=True)
    for fname in KEEP_ROOT_FILES:
        src = MASTER_PROFILE / fname
        if src.exists():
            shutil.copy2(src, clone_dir / fname)
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
    if not clone_dir.exists():
        return
    for attempt in range(5):
        try:
            shutil.rmtree(clone_dir)
            print(f"[OK] Cleaned up {clone_dir}", flush=True)
            return
        except (PermissionError, OSError):
            time.sleep(1)
    shutil.rmtree(clone_dir, ignore_errors=True)
    if clone_dir.exists():
        print(f"[WARN] Could not fully remove {clone_dir}", flush=True)
    else:
        print(f"[OK] Cleaned up {clone_dir} (forced)", flush=True)


async def load_extension(browser: uc.Browser, ext_path: str, name: str) -> str:
    src = Path(ext_path)
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
    parser = argparse.ArgumentParser(description="Cell extension loader (nodriver + clone).")
    parser.add_argument("--no-ublock", action="store_true", help="Skip loading uBlock")
    parser.add_argument("--keep-profile", action="store_true", help="Don't delete clone on exit")
    parser.add_argument("--dev-build", action="store_true", help="Run dev build before launch")
    args = parser.parse_args()

    project_root = Path(CELL_EXT).parent
    if args.dev_build:
        npx = shutil.which("npx") or shutil.which("npx.cmd")
        if not npx:
            print("[FAIL] `npx` not found.", flush=True)
            sys.exit(1)
        print(f"[..] Running dev build in {project_root}...", flush=True)
        result = subprocess.run([npx, "vite", "build", "--mode", "development"], cwd=project_root, shell=False)
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

    clone_dir = clone_master()

    def _cleanup():
        if not args.keep_profile:
            cleanup_clone(clone_dir)
    atexit.register(_cleanup)

    print(f"[..] Launching Chrome (headless): profile={clone_dir}", flush=True)
    config = uc.Config(
        user_data_dir=str(clone_dir),
        headless=True,
        lang="en-US",
        browser_executable_path=CHROME_EXE,
    )
    browser = await uc.start(config)
    print("[OK] Chrome launched (anti-bot: navigator.webdriver=false)", flush=True)

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

    print(flush=True)
    print(f"Clone:  {clone_dir}", flush=True)
    print(flush=True)
    print("[..] Closing Chrome so MCP can reuse the profile...", flush=True)
    browser.stop()
    time.sleep(2)
    print("[OK] Chrome closed. Profile ready for MCP.", flush=True)
    print(flush=True)
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
