"""Pack Cell dist/ into a .crx with a stable key and compute the extension ID."""
import base64, hashlib, subprocess, sys, shutil, json
from pathlib import Path

DIST = Path(r"C:\Users\The0cean\Programming\The0cean ecosystem\cell\dist")
KEY = Path(r"C:\Users\The0cean\Programming\The0cean ecosystem\cell\cell-key.pem")
CRX_OUT = Path(r"C:\Users\The0cean\Programming\The0cean ecosystem\cell\cell.crx")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# Compute extension ID from public key (Chrome algorithm)
def ext_id_from_pem(pem_path: Path) -> str:
    # Extract DER public key
    r = subprocess.run(
        ["openssl", "rsa", "-in", str(pem_path), "-pubout", "-outform", "DER"],
        capture_output=True, timeout=10,
    )
    der_pub = r.stdout
    digest = hashlib.sha256(der_pub).digest()[:16]
    # Map each nibble 0-15 -> a-p
    letters = "abcdefghijklmnop"
    return "".join(letters[b >> 4] + letters[b & 0xF] for b in digest)

ext_id = ext_id_from_pem(KEY)
print(f"[OK] Extension ID from key: {ext_id}")

# Pack: chrome.exe --pack-extension=<dist> --pack-extension-key=<key.pem>
# This produces <dist>.crx in the PARENT of dist (i.e. dist/../dist.crx)
if CRX_OUT.exists():
    CRX_OUT.unlink()
print("[..] Packing .crx via chrome.exe...")
result = subprocess.run(
    [CHROME, f"--pack-extension={DIST}", f"--pack-extension-key={KEY}"],
    capture_output=True, text=True, timeout=30,
)
# chrome.exe --pack-extension creates <dist_parent>/<dist_name>.crx
expected_crx = DIST.parent / f"{DIST.name}.crx"
print(f"[..] Expected crx at: {expected_crx}, exists: {expected_crx.exists()}")
if expected_crx.exists():
    shutil.move(str(expected_crx), str(CRX_OUT))
    print(f"[OK] .crx packed: {CRX_OUT} ({CRX_OUT.stat().st_size} bytes)")
else:
    print(f"[FAIL] .crx not found. chrome stdout: {result.stdout[:200]}")
    print(f"       chrome stderr: {result.stderr[:200]}")
    sys.exit(1)

# Read manifest version
mf = json.loads((DIST / "manifest.json").read_text(encoding="utf-8"))
version = mf["version"]
print(f"[OK] Extension version: {version}")
print(f"[OK] Extension ID: {ext_id}")
print(f"[OK] CRX path: {CRX_OUT}")
print()
print("Next: copy crx to <profile>/Default/Extensions/<id>/<version>/ + External Extensions JSON")
