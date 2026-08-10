"""Task 1 evidence collector — AnimeKai child-iframe Player Mode DOM + screenshot."""
from __future__ import annotations
import asyncio, json, os, shutil, sys, time, uuid
from pathlib import Path
import nodriver as uc

CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SESSION_ROOT = Path(r"C:\stealth-mcp-browser-sessions")
MASTER_PROFILE = SESSION_ROOT / "master"
SESSIONS_DIR = SESSION_ROOT / "sessions"
CELL_EXT = r"C:\Users\The0cean\Programming\The0cean ecosystem\cell\dist"
ANIMEKAI_URL = "https://animekai.be/watch/i-made-friends-with-the-second-prettiest-girl-in-my-class/ep-1"

KEEP_PATTERNS = {"Default": {"Cookies","Cookies-journal","Login Data","Login Data-journal","Web Data","Web Data-journal","Preferences","Secure Preferences","Local Storage","Session Storage","Extension State"}}
KEEP_ROOT_FILES = {"Local State","First Party Sets","first_party_sets.db"}

def clone_master() -> Path:
    clone_id = f"cell-{uuid.uuid4().hex[:12]}"
    clone_dir = SESSIONS_DIR / clone_id
    clone_dir.mkdir(parents=True, exist_ok=True)
    for fname in KEEP_ROOT_FILES:
        src = MASTER_PROFILE / fname
        if src.exists(): shutil.copy2(src, clone_dir / fname)
    src_default = MASTER_PROFILE / "Default"
    dst_default = clone_dir / "Default"
    dst_default.mkdir(exist_ok=True)
    if src_default.exists():
        for item in src_default.iterdir():
            if item.name in KEEP_PATTERNS["Default"]:
                if item.is_dir(): shutil.copytree(item, dst_default / item.name, dirs_exist_ok=True)
                else: shutil.copy2(item, dst_default / item.name)
    print(f"[OK] Cloned master → {clone_dir}")
    return clone_dir

async def load_extension(browser, ext_path, name):
    result = await browser.send(uc.cdp.extensions.load_unpacked(path=ext_path))
    ext_id = result if isinstance(result, str) else getattr(result, "id", str(result))
    print(f"[OK] {name} loaded: ID={ext_id}")
    return ext_id

async def eval_top(tab, expr):
    try: return await tab.evaluate(expr, await_promise=True)
    except Exception as e: return f"ERROR: {e}"

async def click(tab, x, y):
    await tab.send(uc.cdp.input_.dispatch_mouse_event(type_="mousePressed", x=x, y=y, button=uc.cdp.input_.MouseButton.LEFT, click_count=1))
    await asyncio.sleep(0.05)
    await tab.send(uc.cdp.input_.dispatch_mouse_event(type_="mouseReleased", x=x, y=y, button=uc.cdp.input_.MouseButton.LEFT, click_count=1))

async def main():
    if not Path(CELL_EXT).exists():
        print(f"[FAIL] Cell ext not found at {CELL_EXT}"); sys.exit(1)
    clone_dir = clone_master()
    print(f"[..] Launching Chrome (headed): profile={clone_dir}")
    config = uc.Config(user_data_dir=str(clone_dir), headless=False, lang="en-US", browser_executable_path=CHROME_EXE)
    browser = await uc.start(config)
    print("[OK] Chrome launched")
    try: await load_extension(browser, CELL_EXT, "Cell (Video Downloader)")
    except Exception as e:
        print(f"[FAIL] Extension load failed: {e}"); browser.stop(); shutil.rmtree(clone_dir, ignore_errors=True); sys.exit(1)

    print(f"[..] Navigating to {ANIMEKAI_URL}")
    tab = await browser.get(ANIMEKAI_URL)
    await asyncio.sleep(15)
    print("[OK] Page loaded")

    # Get iframe rect
    iframe_info = await eval_top(tab, """
        (() => {
            const iframe = document.querySelector('iframe');
            if (!iframe) return null;
            const rect = iframe.getBoundingClientRect();
            return JSON.stringify({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, src: iframe.src });
        })()
    """)
    print(f"[..] Iframe info: {iframe_info}")

    if not iframe_info:
        print("[FAIL] No iframe found")
        browser.stop(); shutil.rmtree(clone_dir, ignore_errors=True); sys.exit(1)

    iframe_rect = json.loads(iframe_info)

    # Step 1: click center to start video
    cx = iframe_rect["left"] + iframe_rect["width"] / 2
    cy = iframe_rect["top"] + iframe_rect["height"] / 2
    print(f"[..] Clicking iframe center ({cx}, {cy}) to start video...")
    await click(tab, cx, cy)
    await asyncio.sleep(10)

    ss1 = Path(os.environ.get("TEMP", "/tmp")) / f"task1_before_pm_{int(time.time())}.png"
    await tab.save_screenshot(str(ss1))
    print(f"[OK] Screenshot before Player Mode: {ss1}")

    # Step 2: click estimated Player Mode button (bottom-right of iframe)
    # The right cluster has 4 icons; the bottom one is the maximize/Player Mode button.
    # Try x offsets near the right edge and y near the bottom.
    clicked_pm = False
    for offset in [0.94, 0.92, 0.95, 0.9, 0.96]:
        for dy in [55, 65, 75, 45, 85, 35]:
            try_x = iframe_rect["left"] + iframe_rect["width"] * offset
            try_y = iframe_rect["top"] + iframe_rect["height"] - dy
            print(f"[..] Clicking Player Mode area ({try_x}, {try_y}) offset={offset} dy={dy}...")
            await click(tab, try_x, try_y)
            await asyncio.sleep(2)
            fs = await eval_top(tab, "JSON.stringify({isFullscreen: !!document.fullscreenElement, el: document.fullscreenElement?.tagName + '#' + (document.fullscreenElement?.id || '')})")
            if fs and '"isFullscreen":true' in str(fs):
                print(f"[OK] Fullscreen activated at offset {offset} dy={dy}: {fs}")
                clicked_pm = True
                break
        if clicked_pm:
            break

    if not clicked_pm:
        print("[WARN] No fullscreen detected after Player Mode clicks")

    await asyncio.sleep(5)

    # Collect top-frame evidence
    top_evidence = await eval_top(tab, """
        (() => {
            const fs = document.fullscreenElement;
            const iframe = document.querySelector('iframe');
            const fsRect = fs ? fs.getBoundingClientRect() : null;
            const iframeRect = iframe ? iframe.getBoundingClientRect() : null;
            return JSON.stringify({
                isFullscreen: !!fs,
                fullscreenElement: fs ? fs.tagName + '#' + (fs.id || '') : null,
                fullscreenRect: fsRect ? { top: fsRect.top, left: fsRect.left, width: fsRect.width, height: fsRect.height } : null,
                iframeSrc: iframe?.src,
                iframeRect: iframeRect ? { top: iframeRect.top, left: iframeRect.left, width: iframeRect.width, height: iframeRect.height } : null
            });
        })()
    """)
    print(f"[OK] Top-frame evidence: {top_evidence}")

    ss2 = Path(os.environ.get("TEMP", "/tmp")) / f"task1_after_pm_{int(time.time())}.png"
    await tab.save_screenshot(str(ss2))
    print(f"[OK] Screenshot after Player Mode: {ss2}")

    # Step 3: click exit Player Mode button (bottom-right of dock)
    print("[..] Clicking Player Mode exit button...")
    # The exit button is in the dock's action area, bottom-right.
    # In fullscreen (2560x1440) the button is ~34px at far right/bottom.
    exit_x = 2520
    exit_y = 1410
    await click(tab, exit_x, exit_y)
    await asyncio.sleep(3)

    ss3 = Path(os.environ.get("TEMP", "/tmp")) / f"task1_after_exit_{int(time.time())}.png"
    await tab.save_screenshot(str(ss3))
    print(f"[OK] Screenshot after exit: {ss3}")

    exit_evidence = await eval_top(tab, "JSON.stringify({isFullscreen: !!document.fullscreenElement, el: document.fullscreenElement?.tagName + '#' + (document.fullscreenElement?.id || '')})")
    print(f"[OK] Exit evidence: {exit_evidence}")

    evidence_path = Path(os.environ.get("TEMP", "/tmp")) / f"task1_evidence_{int(time.time())}.json"
    with open(evidence_path, 'w') as f:
        json.dump({
            "url": ANIMEKAI_URL,
            "top_evidence": json.loads(top_evidence) if isinstance(top_evidence, str) and top_evidence.startswith('{') else top_evidence,
            "exit_evidence": json.loads(exit_evidence) if isinstance(exit_evidence, str) and exit_evidence.startswith('{') else exit_evidence,
            "screenshots": {"before_pm": str(ss1), "after_pm": str(ss2), "after_exit": str(ss3)}
        }, f, indent=2)
    print(f"[OK] Evidence saved: {evidence_path}")

    print("\n[..] Closing browser...")
    browser.stop()
    await asyncio.sleep(2)
    shutil.rmtree(clone_dir, ignore_errors=True)
    print("[OK] Done.")

if __name__ == "__main__":
    asyncio.run(main())
