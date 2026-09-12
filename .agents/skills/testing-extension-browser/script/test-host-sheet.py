"""Test host-page subtitle manager sheet on cross-origin iframe page.

Uses CDP Target.getTargets + browser.attach() to access the cross-origin iframe's DOM,
click the subtitle manager button, and verify the sheet renders on the host page.
Tests: AC-01 (open on mobile), AC-04/05 (resize reparenting), AC-06 (close), AC-11 (8px gap).
"""

import asyncio
import json
import os
import shutil
import sys
import time
import uuid
from pathlib import Path

import nodriver as uc

CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SESSION_ROOT = Path(r"C:\stealth-mcp-browser-sessions")
MASTER_PROFILE = SESSION_ROOT / "master"
SESSIONS_DIR = SESSION_ROOT / "sessions"
CELL_EXT = str(Path(__file__).resolve().parents[4] / "dist")
UBLOCK_EXT = str(Path(__file__).resolve().parents[4] / "data" / "extension" / "uBOLite")

TEST_URL = "https://animekai.be/watch/i-made-friends-with-the-second-prettiest-girl-in-my-class/ep-2"

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
    clone_id = f"cell-host-{uuid.uuid4().hex[:12]}"
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
    print(f"[OK] Cloned master → {clone_dir}", flush=True)
    return clone_dir


async def load_extension(browser, ext_path, name):
    src = Path(ext_path)
    if (src / "_metadata").exists() or name == "uBlock":
        tmp = Path(os.environ.get("TEMP", "/tmp")) / f"cell-ext-{uuid.uuid4().hex[:8]}"
        if tmp.exists():
            shutil.rmtree(tmp, ignore_errors=True)
        import subprocess
        result = subprocess.run(
            ["robocopy", str(src), str(tmp), "/E", "/NFL", "/NDL", "/NP", "/NS", "/NC",
             "/R:1", "/W:1", "/XF", "easylist.js"],
            shell=False, capture_output=True, timeout=30,
        )
        if result.returncode >= 8:
            raise RuntimeError(f"robocopy failed: {result.stderr.decode(errors='replace')}")
        meta = tmp / "_metadata"
        if meta.exists():
            shutil.rmtree(meta, ignore_errors=True)
        ext_path = str(tmp)
    result = await browser.send(uc.cdp.extensions.load_unpacked(path=ext_path))
    ext_id = result if isinstance(result, str) else getattr(result, "id", str(result))
    print(f"[OK] {name} loaded: ID={ext_id}", flush=True)
    return ext_id


def parse_eval_result(result):
    """Parse CDP Runtime.evaluate result — returns (remote_object, exception_details)."""
    if isinstance(result, tuple) and len(result) == 2:
        remote_obj, exc = result
        if exc:
            return {"error": exc.text if hasattr(exc, 'text') else str(exc)}
        if hasattr(remote_obj, 'value') and remote_obj.value is not None:
            val = remote_obj.value
            if isinstance(val, str):
                try:
                    return json.loads(val)
                except:
                    return val
            return val
        if hasattr(remote_obj, 'description') and remote_obj.description:
            return remote_obj.description
        return {"raw": str(remote_obj)}
    return result


def parse_json(raw):
    """Parse nodriver evaluate result — may be string or key-value list."""
    if isinstance(raw, str):
        return json.loads(raw)
    if isinstance(raw, list) and len(raw) == 2 and raw[0] == "":
        return json.loads(raw[1])
    if isinstance(raw, dict):
        return raw
    return raw


async def eval_in_iframe(browser, tab, expression):
    """Find the megaplay iframe target, attach to it, and evaluate expression.
    Uses tab.send() for Target.getTargets (browser-level command).
    Returns the parsed result or None if iframe not found."""
    # Use tab.send() for Target.getTargets — tab has its own connection
    targets = await tab.send(uc.cdp.target.get_targets())
    iframe_info = None
    for info in targets:
        url = getattr(info, 'url', '') or ''
        if "megaplay" in url:
            iframe_info = info
            break
    if not iframe_info:
        print("  [WARN] No megaplay iframe target found", flush=True)
        return None
    # Attach to iframe target via browser.attach() — sets browser.session_id
    await browser.attach(iframe_info)
    await browser.send(uc.cdp.runtime.enable())
    result = await browser.send(uc.cdp.runtime.evaluate(
        expression=expression,
        return_by_value=True,
    ))
    return parse_eval_result(result)


async def eval_on_host(tab, expression):
    """Evaluate expression on the host page via tab.evaluate()."""
    raw = await tab.evaluate(expression, await_promise=False)
    return parse_json(raw)


async def main():
    clone_dir = clone_master()

    config = uc.Config(
        user_data_dir=str(clone_dir),
        headless=False,
        lang="en-US",
        browser_executable_path=CHROME_EXE,
    )
    browser = await uc.start(config)
    print("[OK] Chrome launched", flush=True)

    await load_extension(browser, CELL_EXT, "Cell")
    await load_extension(browser, UBLOCK_EXT, "uBlock")
    await asyncio.sleep(2)

    # Navigate to about:blank first, then to test page
    page = await browser.get("about:blank")
    tab = browser.main_tab
    screenshot_path = str(Path(CELL_EXT).parent / "test-host-sheet-screenshot.png")

    # Now navigate to the test page
    page = await browser.get(TEST_URL)
    print(f"[OK] Navigated to {TEST_URL}", flush=True)
    await asyncio.sleep(12)
    print("[OK] Waited 12s for page load", flush=True)

    # === Setup: Emulate mobile viewport ===
    await tab.send(uc.cdp.emulation.set_device_metrics_override(
        width=400, height=800, mobile=True, device_scale_factor=2,
    ))
    print("[OK] Emulated mobile viewport (400x800)", flush=True)
    await asyncio.sleep(3)

    # === AC-01: Open subtitle manager on mobile → sheet renders on host page ===
    print(f"\n{'='*60}", flush=True)
    print("=== AC-01: Open subtitle manager on mobile viewport ===", flush=True)
    print(f"{'='*60}", flush=True)

    # Click manager button inside iframe
    mgr_result = await eval_in_iframe(browser, tab, """(() => {
        const cellRoot = document.querySelector('#cell-subtitle-root');
        if (!cellRoot || !cellRoot.shadowRoot) return JSON.stringify({ error: 'no cell root' });
        const sr = cellRoot.shadowRoot;
        const v = document.querySelector('video');
        if (v && v.paused) v.play();
        const mgrBtn = sr.querySelector('[data-cell-id="manager-toggle-btn"]');
        if (mgrBtn) { mgrBtn.click(); return JSON.stringify({ clicked: true, ariaLabel: mgrBtn.getAttribute('aria-label') }); }
        return JSON.stringify({ clicked: false });
    })()""")
    print(f"Manager button click: {json.dumps(mgr_result, indent=2)}", flush=True)
    await asyncio.sleep(3)

    # Check host page for #cell-host-manager-sheet
    host_result = await eval_on_host(tab, """(() => {
        const hs = document.querySelector('#cell-host-manager-sheet');
        if (!hs) return JSON.stringify({ hasHostSheet: false, allCellEls: Array.from(document.querySelectorAll('[id^="cell-"]')).map(e => e.id) });
        const sr = hs.shadowRoot;
        const sheetEl = sr?.querySelector('[class*="sheet"]') ?? null;
        const sheetRect = sheetEl?.getBoundingClientRect() ?? null;
        return JSON.stringify({
            hasHostSheet: true,
            shadowChildren: sr?.children?.length ?? 0,
            totalEls: sr?.querySelectorAll('*')?.length ?? 0,
            hasBackdrop: !!sr?.querySelector('[class*="backdrop"]'),
            hasManagerText: (sr?.textContent ?? '').includes('Subtitle Manager'),
            sheetRect: sheetRect ? { x: Math.round(sheetRect.x), y: Math.round(sheetRect.y), w: Math.round(sheetRect.width), h: Math.round(sheetRect.height) } : null,
            classes: sr ? Array.from(sr.querySelectorAll('[class]')).slice(0, 15).map(e => e.className?.baseVal || e.className || '') : [],
        });
    })()""")
    print(f"\nHost page check: {json.dumps(host_result, indent=2)}", flush=True)

    ac01_pass = host_result.get("hasHostSheet", False)
    print(f"\nAC-01: {'PASS' if ac01_pass else 'FAIL'} — Sheet renders on host page", flush=True)

    # AC-11: 8px gap check
    if host_result.get("sheetRect"):
        r = host_result["sheetRect"]
        left_gap = r["x"]
        right_gap = 400 - r["x"] - r["w"]
        bottom_gap = 800 - r["y"] - r["h"]
        print(f"\nAC-11: Sheet rect = {r}", flush=True)
        print(f"  Left gap: {left_gap}px, Right gap: {right_gap}px, Bottom gap: {bottom_gap}px", flush=True)
        ac11_pass = left_gap == 8 and right_gap == 8 and bottom_gap == 8
        print(f"AC-11: {'PASS' if ac11_pass else 'FAIL'} — 8px gap on all edges", flush=True)

    # Take screenshot
    await page.save_screenshot(screenshot_path)
    print(f"\n[OK] Screenshot: {screenshot_path}", flush=True)

    # === AC-04/05: Resize desktop→mobile→desktop reparenting ===
    print(f"\n{'='*60}", flush=True)
    print("=== AC-04/05: Resize reparenting test ===", flush=True)
    print(f"{'='*60}", flush=True)

    # Switch to desktop viewport
    await tab.send(uc.cdp.emulation.set_device_metrics_override(
        width=1200, height=800, mobile=False, device_scale_factor=1,
    ))
    print("[OK] Switched to desktop viewport (1200x800)", flush=True)
    await asyncio.sleep(5)

    # Check iframe's matchMedia state
    mq_result = await eval_in_iframe(browser, tab, """JSON.stringify({
        innerWidth: window.innerWidth,
        matchMedia767: window.matchMedia('(max-width: 767px)').matches,
    })""")
    print(f"  Iframe matchMedia: {json.dumps(mq_result)}", flush=True)

    # Check host page — host sheet should be gone
    host_desktop = await eval_on_host(tab, """(() => {
        const hs = document.querySelector('#cell-host-manager-sheet');
        if (!hs) return JSON.stringify({ hasHostSheet: false });
        const sr = hs.shadowRoot;
        return JSON.stringify({ hasHostSheet: true, children: sr?.children?.length ?? 0, totalEls: sr?.querySelectorAll('*')?.length ?? 0 });
    })()""")
    print(f"  Desktop host sheet: {json.dumps(host_desktop)}", flush=True)

    # Check iframe — sheet should render inside iframe (not delegated)
    iframe_desktop = await eval_in_iframe(browser, tab, """(() => {
        const cellRoot = document.querySelector('#cell-subtitle-root');
        if (!cellRoot || !cellRoot.shadowRoot) return JSON.stringify({ error: 'no cell root' });
        const sr = cellRoot.shadowRoot;
        const portal = sr.querySelector('[data-cell-id="subtitle-manager-layer"]');
        const panels = sr.querySelectorAll('[class*="panel"]');
        const visiblePanels = Array.from(panels).filter(p => getComputedStyle(p).display !== 'none' && p.offsetHeight > 0);
        return JSON.stringify({
            hasManagerPortal: !!portal,
            portalVisible: portal ? getComputedStyle(portal).display !== 'none' : false,
            panelCount: panels.length,
            visiblePanelCount: visiblePanels.length,
            shadowChildren: sr.children.length,
        });
    })()""")
    print(f"  Desktop iframe check: {json.dumps(iframe_desktop, indent=2)}", flush=True)

    ac04_pass = not host_desktop.get("hasHostSheet", False)
    print(f"\nAC-04/05: {'PASS' if ac04_pass else 'FAIL'} — Host sheet closes on desktop resize", flush=True)

    # Take desktop screenshot
    await page.save_screenshot(screenshot_path.replace(".png", "-desktop.png"))

    # Switch back to mobile
    await tab.send(uc.cdp.emulation.set_device_metrics_override(
        width=400, height=800, mobile=True, device_scale_factor=2,
    ))
    print("[OK] Switched back to mobile viewport (400x800)", flush=True)
    await asyncio.sleep(5)

    # Re-click manager button
    reclick = await eval_in_iframe(browser, tab, """(() => {
        const cellRoot = document.querySelector('#cell-subtitle-root');
        if (!cellRoot || !cellRoot.shadowRoot) return JSON.stringify({ error: 'no cell root' });
        const sr = cellRoot.shadowRoot;
        const mgrBtn = sr.querySelector('[data-cell-id="manager-toggle-btn"]');
        if (mgrBtn) { mgrBtn.click(); return JSON.stringify({ clicked: true }); }
        return JSON.stringify({ clicked: false });
    })()""")
    print(f"  Re-click manager: {json.dumps(reclick)}", flush=True)
    await asyncio.sleep(3)

    # Check host page again
    host_mobile2 = await eval_on_host(tab, """(() => {
        const hs = document.querySelector('#cell-host-manager-sheet');
        if (!hs) return JSON.stringify({ hasHostSheet: false });
        return JSON.stringify({ hasHostSheet: true, children: hs.shadowRoot?.children?.length ?? 0 });
    })()""")
    print(f"  Mobile (after resize back): {json.dumps(host_mobile2)}", flush=True)

    ac05_pass = host_mobile2.get("hasHostSheet", False)
    print(f"AC-05: {'PASS' if ac05_pass else 'FAIL'} — Sheet re-renders on host after mobile resize back", flush=True)

    # === AC-06: Close mechanisms ===
    print(f"\n{'='*60}", flush=True)
    print("=== AC-06: Close mechanism test ===", flush=True)
    print(f"{'='*60}", flush=True)

    # Test 1: ESC key (Sheet component listens on document)
    print("  [..] Trying ESC key...", flush=True)
    esc_result = await eval_on_host(tab, """(() => {
        const event = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
        });
        document.dispatchEvent(event);
        return JSON.stringify({ dispatched: true });
    })()""")
    print(f"  ESC dispatch: {json.dumps(esc_result)}", flush=True)
    await asyncio.sleep(2)

    # Check if sheet closed
    closed_esc = await eval_on_host(tab, """(() => {
        const hs = document.querySelector('#cell-host-manager-sheet');
        if (!hs) return JSON.stringify({ closed: true, hasHostSheet: false });
        const sr = hs.shadowRoot;
        return JSON.stringify({ closed: false, hasHostSheet: true, children: sr?.children?.length ?? 0, totalEls: sr?.querySelectorAll('*')?.length ?? 0 });
    })()""")
    print(f"  After ESC: {json.dumps(closed_esc)}", flush=True)
    ac06_esc = closed_esc.get("closed", False)
    print(f"  AC-06 (ESC): {'PASS' if ac06_esc else 'FAIL'}", flush=True)

    # If ESC didn't work, try backdrop click with proper event
    if not ac06_esc:
        print("  [..] Trying backdrop click with MouseEvent...", flush=True)
        close_result = await eval_on_host(tab, """(() => {
            const hs = document.querySelector('#cell-host-manager-sheet');
            if (!hs || !hs.shadowRoot) return JSON.stringify({ error: 'no host sheet' });
            const sr = hs.shadowRoot;
            const backdrop = sr.querySelector('[class*="backdrop"]');
            if (backdrop) {
                backdrop.click();
                return JSON.stringify({ clicked: true, hasBackdrop: true });
            }
            return JSON.stringify({ clicked: false, hasBackdrop: false });
        })()""")
        print(f"  Backdrop click: {json.dumps(close_result)}", flush=True)
        await asyncio.sleep(2)

        closed_result = await eval_on_host(tab, """(() => {
            const hs = document.querySelector('#cell-host-manager-sheet');
            if (!hs) return JSON.stringify({ closed: true, hasHostSheet: false });
            const sr = hs.shadowRoot;
            return JSON.stringify({ closed: false, hasHostSheet: true, children: sr?.children?.length ?? 0, totalEls: sr?.querySelectorAll('*')?.length ?? 0 });
        })()""")
        print(f"  After backdrop click: {json.dumps(closed_result)}", flush=True)
        ac06_backdrop = closed_result.get("closed", False)
        print(f"  AC-06 (backdrop): {'PASS' if ac06_backdrop else 'FAIL'}", flush=True)

    # If still not closed, try X button
    if not ac06_esc and not ac06_backdrop:
        print("  [..] Trying X button close...", flush=True)
        x_close = await eval_on_host(tab, """(() => {
            const hs = document.querySelector('#cell-host-manager-sheet');
            if (!hs || !hs.shadowRoot) return JSON.stringify({ error: 'no host sheet' });
            const sr = hs.shadowRoot;
            const xIcon = sr.querySelector('.lucide-x');
            const closeBtn = xIcon?.closest('button');
            if (closeBtn) {
                closeBtn.click();
                return JSON.stringify({ clicked: true, found: true });
            }
            return JSON.stringify({ clicked: false, found: false });
        })()""")
        print(f"  X button click: {json.dumps(x_close)}", flush=True)
        await asyncio.sleep(2)

        closed_result2 = await eval_on_host(tab, """(() => {
            const hs = document.querySelector('#cell-host-manager-sheet');
            if (!hs) return JSON.stringify({ closed: true });
            return JSON.stringify({ closed: false, children: hs.shadowRoot?.children?.length ?? 0 });
        })()""")
        print(f"  After X button: {json.dumps(closed_result2)}", flush=True)
        ac06_x = closed_result2.get("closed", False)
        print(f"  AC-06 (X button): {'PASS' if ac06_x else 'FAIL'}", flush=True)

    # Take final screenshot
    await page.save_screenshot(screenshot_path.replace(".png", "-final.png"))

    # === Summary ===
    print(f"\n{'='*60}", flush=True)
    print("=== SUMMARY ===", flush=True)
    print(f"{'='*60}", flush=True)
    print(f"AC-01: Sheet renders on host page (mobile): {'PASS' if ac01_pass else 'FAIL'}", flush=True)
    if host_result.get("sheetRect"):
        print(f"AC-11: 8px gap on all edges: {'PASS' if ac11_pass else 'FAIL'}", flush=True)
    print(f"AC-04: Host sheet closes on desktop resize: {'PASS' if ac04_pass else 'FAIL'}", flush=True)
    print(f"AC-05: Sheet re-renders on host after mobile back: {'PASS' if ac05_pass else 'FAIL'}", flush=True)
    print(f"AC-06: Close mechanism (ESC): {'PASS' if ac06_esc else 'FAIL'}", flush=True)

    await asyncio.sleep(2)
    browser.stop()
    print("\n[OK] Done.", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
