"""test-ocr-e2e.py — End-to-end OCR test via nodriver.

Loads Cell extension, navigates to mock hardsub page, triggers OCR,
and verifies hitbox overlay displays with detected text.

Usage:
  uv run --python 3.11 --with nodriver python -u scripts/test-ocr-e2e.py
"""
import asyncio
import json
import os
import shutil
import uuid
from pathlib import Path

import nodriver as uc

CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SESSION_ROOT = Path(r"C:\stealth-mcp-browser-sessions")
MASTER_PROFILE = SESSION_ROOT / "master"
SESSIONS_DIR = SESSION_ROOT / "sessions"
CELL_EXT = r"C:\Users\The0cean\Programming\The0cean ecosystem\cell\dist"
MOCK_URL = "http://127.0.0.1:4325/"


def clone_master() -> Path:
    clone_id = f"cell-ocr-{uuid.uuid4().hex[:12]}"
    clone_dir = SESSIONS_DIR / clone_id
    clone_dir.mkdir(parents=True, exist_ok=True)
    src_default = MASTER_PROFILE / "Default"
    dst_default = clone_dir / "Default"
    dst_default.mkdir(exist_ok=True)
    keep = {"Cookies", "Cookies-journal", "Login Data", "Login Data-journal",
            "Web Data", "Web Data-journal", "Preferences", "Secure Preferences",
            "Local Storage", "Session Storage", "Extension State"}
    if src_default.exists():
        for item in src_default.iterdir():
            if item.name in keep:
                if item.is_dir():
                    shutil.copytree(item, dst_default / item.name, dirs_exist_ok=True, ignore=shutil.ignore_patterns("LOCK"))
                else:
                    shutil.copy2(item, dst_default / item.name)
    for fname in {"Local State", "First Party Sets", "first_party_sets.db"}:
        src = MASTER_PROFILE / fname
        if src.exists():
            shutil.copy2(src, clone_dir / fname)
    return clone_dir


async def main():
    clone_dir = clone_master()
    print(f"[OK] Cloned master → {clone_dir}")

    browser = await uc.start(
        headless=False,
        browser_executable_path=CHROME_EXE,
        user_data_dir=str(clone_dir),
    )
    print("[OK] Chrome launched")

    # Load Cell extension via CDP
    result = await browser.send(uc.cdp.extensions.load_unpacked(path=CELL_EXT))
    ext_id = result if isinstance(result, str) else getattr(result, "id", str(result))
    print(f"[OK] Cell loaded: ID={ext_id}")

    # Navigate to mock page
    tab = await browser.get(MOCK_URL)
    await tab.sleep(3)
    print(f"[OK] Navigated to {MOCK_URL}")

    # Play video
    await tab.evaluate("document.querySelector('video').muted = true; document.querySelector('video').play(); document.getElementById('play').click();")
    await tab.sleep(2)
    print("[OK] Video playing")

    # Trigger OCR debug init
    await tab.evaluate("window.postMessage({ type: '__CELL_OCR_DEBUG_INIT', origin: '127.0.0.1', languageMode: 'auto' }, '*');")
    print("[OK] OCR debug init sent")

    # Wait for OCR init + pipeline to process frames
    print("[..] Waiting 30s for OCR init + pipeline...")
    await tab.sleep(30)

    # Check results
    result = await tab.evaluate("""
        (() => {
            const ds = document.body.dataset;
            const hitboxes = document.querySelectorAll('.cell-ocr-hitbox');
            const video = document.querySelector('video');
            return JSON.stringify({
                ocrDebugStep: ds.ocrDebugStep,
                ocrInitResult: ds.ocrInitResult,
                ocrDebugException: ds.ocrDebugException,
                videoTime: video?.currentTime,
                hitboxCount: hitboxes.length,
                hitboxTexts: Array.from(hitboxes).map(h => h.dataset.cellTerm),
                hitboxLangs: Array.from(hitboxes).map(h => h.dataset.cellLang),
                pipelineStatuses: ds.ocrPipelineStatuses,
                ocrLastResult: ds.ocrLastResult,
                ocrLastError: ds.ocrLastError,
                ocrErrors: ds.ocrErrors,
            });
        })()
    """, return_by_value=True)
    print(f"\n[RESULT] {result}")

    # Take screenshot before click
    screenshot_data = await tab.send(uc.cdp.page.capture_screenshot(format_='png'))
    if screenshot_data:
        import base64
        screenshot_path = Path(clone_dir) / "ocr_before_click.png"
        screenshot_path.write_bytes(base64.b64decode(screenshot_data))
        print(f"[OK] Screenshot saved: {screenshot_path}")

    # === Test dictionary popup from hitbox click ===
    # Seek to a time with subtitle, wait for hitbox, then click it.
    print("\n[TEST] Dictionary popup from hitbox click")
    await tab.evaluate("document.querySelector('video').currentTime = 1;")  # "Hello World" cue
    await tab.sleep(5)  # Wait for pipeline to detect text

    # Check hitbox exists
    hitbox_info = await tab.evaluate("""
        (() => {
            const hitboxes = document.querySelectorAll('.cell-ocr-hitbox');
            if (hitboxes.length === 0) return JSON.stringify({ error: 'no hitboxes' });
            const hb = hitboxes[0];
            const rect = hb.getBoundingClientRect();
            return JSON.stringify({
                count: hitboxes.length,
                texts: Array.from(hitboxes).map(h => h.dataset.cellTerm),
                rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
                centerX: rect.x + rect.width / 2,
                centerY: rect.y + rect.height / 2,
            });
        })()
    """, return_by_value=True)
    print(f"[HITBOX] {hitbox_info}")

    # Click the hitbox center via JS dispatch
    import json as jsonmod
    try:
        info = jsonmod.loads(hitbox_info)
        if 'centerX' in info:
            cx, cy = int(info['centerX']), int(info['centerY'])
            print(f"[CLICK] Clicking hitbox at ({cx}, {cy})")
            # Use JS to simulate click on the hitbox element directly
            click_result = await tab.evaluate(f"""
                (() => {{
                    const hitboxes = document.querySelectorAll('.cell-ocr-hitbox');
                    if (hitboxes.length === 0) return 'no hitboxes';
                    const hb = hitboxes[0];
                    const rect = hb.getBoundingClientRect();
                    const cx = rect.x + rect.width / 2;
                    const cy = rect.y + rect.height / 2;
                    // Dispatch click event directly on the hitbox
                    const clickEvt = new MouseEvent('click', {{
                        bubbles: true,
                        cancelable: true,
                        clientX: cx,
                        clientY: cy,
                    }});
                    hb.dispatchEvent(clickEvt);
                    return 'clicked: text=' + hb.dataset.cellTerm + ' lang=' + hb.dataset.cellLang;
                }})()
            """, return_by_value=True)
            print(f"[CLICK RESULT] {click_result}")
            await tab.sleep(3)  # Wait for popup to appear

            # Check for dictionary popup
            popup_info = await tab.evaluate("""
                (() => {
                    // Check for popup in shadow DOMs
                    const allShadowHosts = [];
                    document.querySelectorAll('*').forEach(el => {
                        if (el.shadowRoot) allShadowHosts.push(el);
                    });
                    const popupInShadow = [];
                    for (const host of allShadowHosts) {
                        const sr = host.shadowRoot;
                        const popup = sr.querySelector('[data-cell-popup-host], .js-cell-popup-host, .cell-dictionary-popup, [data-cell-dict-popup]');
                        if (popup) {
                            popupInShadow.push({ hostTag: host.tagName, hostId: host.id, popupTag: popup.tagName, popupClass: popup.className?.slice(0, 80) });
                        }
                    }
                    // Also check light DOM
                    const lightPopup = document.querySelector('[data-cell-popup-host], .js-cell-popup-host, .cell-dictionary-popup, [data-cell-dict-popup]');
                    // Check for any visible popup-like elements
                    const allElements = document.querySelectorAll('div[class*="popup" i], div[id*="popup" i], div[class*="dict" i]');
                    return JSON.stringify({
                        lightPopupFound: !!lightPopup,
                        lightPopupTag: lightPopup?.tagName,
                        lightPopupClass: lightPopup?.className?.slice(0, 80),
                        shadowHostCount: allShadowHosts.length,
                        popupInShadowCount: popupInShadow.length,
                        popupInShadow: popupInShadow.slice(0, 3),
                        popupLikeElements: Array.from(allElements).slice(0, 5).map(e => ({ tag: e.tagName, id: e.id, class: e.className?.slice(0, 60) })),
                    });
                })()
            """, return_by_value=True)
            print(f"[POPUP] {popup_info}")

            # Screenshot after click
            screenshot_data2 = await tab.send(uc.cdp.page.capture_screenshot(format_='png'))
            if screenshot_data2:
                screenshot_path2 = Path(clone_dir) / "ocr_after_click.png"
                screenshot_path2.write_bytes(base64.b64decode(screenshot_data2))
                print(f"[OK] Screenshot saved: {screenshot_path2}")
    except Exception as e:
        print(f"[ERROR] Click test failed: {e}")

    # Stop browser
    browser.stop()
    print("[OK] Done")


if __name__ == "__main__":
    asyncio.run(main())
