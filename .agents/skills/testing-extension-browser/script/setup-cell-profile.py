"""setup-cell-profile.py — Pack Cell .crx + clone master + write External Extensions JSON.

Workflow: pack .crx (one-time per build) → clone master → write External Extensions
JSON → print clone path. Then MCP spawn_browser(user_data_dir=<clone>) auto-loads
Cell. No nodriver, no debugging port — MCP stealth handles anti-bot.

Chrome 151 root cause (verified):
  - CDP loadUnpacked: session-only (close = lost, NOT persisted to Preferences)
  - --load-extension flag: completely blocked (doesn't load at all)
  - Preferences location=4 (unpacked): stripped on launch
  - MCP execute_cdp_command: no Extensions domain
  - External Extensions JSON + packed .crx: WORKS ✓ (Chrome installs .crx on
    launch from the JSON, extension persists across spawns)

Usage:
  python setup-cell-profile.py                    # pack if .crx missing, clone, setup
  python setup-cell-profile.py --rebuild          # force re-pack .crx (after code change)
  python setup-cell-profile.py --no-ublock        # skip uBlock
  python setup-cell-profile.py --keep-profile     # don't auto-cleanup clone on exit

After this prints CLONE_PATH=..., use MCP:
  spawn_browser(user_data_dir="<CLONE_PATH>", headless=false)
  navigate(url="https://...")
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

# --- SSOT config ---
CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SESSION_ROOT = Path(r"C:\stealth-mcp-browser-sessions")
MASTER_PROFILE = SESSION_ROOT / "master"
SESSIONS_DIR = SESSION_ROOT / "sessions"
PROJECT_ROOT = Path(r"C:\Users\The0cean\Programming\The0cean ecosystem\cell")
CELL_EXT = PROJECT_ROOT / "dist"
CELL_KEY = PROJECT_ROOT / "cell-key.pem"
CELL_CRX = PROJECT_ROOT / "cell.crx"
UBLOCK_EXT = PROJECT_ROOT / "data" / "extension" / "uBOLite"
UBLOCK_KEY = PROJECT_ROOT / "ublock-key.pem"
UBLOCK_CRX = PROJECT_ROOT / "ublock.crx"

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


def ext_id_from_pem(pem_path: Path) -> str:
    """Compute Chrome extension ID from an RSA private key (PEM)."""
    r = subprocess.run(
        ["openssl", "rsa", "-in", str(pem_path), "-pubout", "-outform", "DER"],
        capture_output=True, timeout=10,
    )
    if r.returncode != 0:
        raise RuntimeError(f"openssl failed: {r.stderr.decode(errors='replace')}")
    digest = hashlib.sha256(r.stdout).digest()[:16]
    letters = "abcdefghijklmnop"
    return "".join(letters[b >> 4] + letters[b & 0xF] for b in digest)


def pack_crx(ext_dir: Path, key_path: Path, crx_out: Path) -> str:
    """Pack an unpacked extension into .crx via chrome.exe --pack-extension.
    Returns the extension ID computed from the key."""
    ext_id = ext_id_from_pem(key_path)
    if crx_out.exists():
        crx_out.unlink()
    # chrome.exe --pack-extension creates <parent>/<name>.crx
    expected = ext_dir.parent / f"{ext_dir.name}.crx"
    if expected.exists():
        expected.unlink()
    result = subprocess.run(
        [CHROME_EXE, f"--pack-extension={ext_dir}", f"--pack-extension-key={key_path}"],
        capture_output=True, text=True, timeout=60,
    )
    if not expected.exists():
        raise RuntimeError(
            f"Pack failed: {expected} not created. chrome stderr: {result.stderr[:300]}"
        )
    shutil.move(str(expected), str(crx_out))
    print(f"[OK] Packed {crx_out.name}: {crx_out.stat().st_size:,} bytes (ID={ext_id})")
    return ext_id


def ensure_key(key_path: Path) -> None:
    """Generate an RSA 2048 key if it doesn't exist."""
    if key_path.exists():
        return
    key_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["openssl", "genrsa", "-out", str(key_path), "2048"],
        check=True, capture_output=True, timeout=10,
    )
    print(f"[OK] Generated key: {key_path}")


def clone_master() -> Path:
    """Clone essential files from master → sessions/<uuid>."""
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
                    shutil.copytree(item, dst_default / item.name, dirs_exist_ok=True,
                                    ignore=shutil.ignore_patterns("LOCK"))
                else:
                    shutil.copy2(item, dst_default / item.name)
    size_mb = sum(f.stat().st_size for f in clone_dir.rglob("*") if f.is_file()) / 1_000_000
    print(f"[OK] Cloned master → {clone_dir} ({size_mb:.1f} MB)")
    return clone_dir


def write_external_extensions(clone_dir: Path, ext_id: str, crx_path: Path, version: str) -> None:
    """Write External Extensions JSON so Chrome installs the .crx on launch."""
    ext_ext_dir = clone_dir / "Default" / "External Extensions"
    ext_ext_dir.mkdir(parents=True, exist_ok=True)
    json_path = ext_ext_dir / f"{ext_id}.json"
    json_path.write_text(json.dumps({
        "external_crx": str(crx_path),
        "external_version": version,
    }), encoding="utf-8")
    print(f"[OK] External Extensions JSON: {json_path}")


def read_version(ext_dir: Path) -> str:
    mf = json.loads((ext_dir / "manifest.json").read_text(encoding="utf-8"))
    return mf["version"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Pack Cell .crx + setup clone profile for MCP spawn.")
    parser.add_argument("--rebuild", action="store_true", help="Force re-pack .crx (after code change + npm run build)")
    parser.add_argument("--no-ublock", action="store_true", help="Skip uBlock")
    parser.add_argument("--keep-profile", action="store_true", help="Don't auto-cleanup clone on exit (for debugging)")
    args = parser.parse_args()

    # --- 0. Verify dist exists ---
    if not CELL_EXT.exists():
        print(f"[FAIL] {CELL_EXT} not found — run 'npm run build' first.", flush=True)
        return 1

    cell_version = read_version(CELL_EXT)
    print(f"[..] Cell version: {cell_version}")

    # --- 1. Pack .crx (if missing or --rebuild) ---
    ensure_key(CELL_KEY)
    need_pack = args.rebuild or not CELL_CRX.exists()
    if need_pack:
        cell_id = pack_crx(CELL_EXT, CELL_KEY, CELL_CRX)
    else:
        cell_id = ext_id_from_pem(CELL_KEY)
        print(f"[OK] Cell .crx exists (ID={cell_id}), use --rebuild to re-pack")

    # --- 2. Pack uBlock .crx (optional) ---
    ublock_id = None
    if not args.no_ublock and UBLOCK_EXT.exists():
        ensure_key(UBLOCK_KEY)
        ublock_version = read_version(UBLOCK_EXT)
        need_ub_pack = args.rebuild or not UBLOCK_CRX.exists()
        if need_ub_pack:
            ublock_id = pack_crx(UBLOCK_EXT, UBLOCK_KEY, UBLOCK_CRX)
        else:
            ublock_id = ext_id_from_pem(UBLOCK_KEY)
            print(f"[OK] uBlock .crx exists (ID={ublock_id})")

    # --- 3. Clone master ---
    clone_dir = clone_master()

    # --- 4. Write External Extensions JSON ---
    write_external_extensions(clone_dir, cell_id, CELL_CRX, cell_version)
    if ublock_id:
        write_external_extensions(clone_dir, ublock_id, UBLOCK_CRX, ublock_version)

    # --- 5. Print clone path for MCP ---
    print()
    print(f"CLONE_PATH={clone_dir}")
    print()
    print("Next: MCP spawn_browser + navigate.")
    print(f'  spawn_browser(user_data_dir="{clone_dir}", headless=false)')
    print(f'  navigate(url="https://...")')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
