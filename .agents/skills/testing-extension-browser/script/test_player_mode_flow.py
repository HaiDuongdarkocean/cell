#!/usr/bin/env python3
"""
test_player_mode_flow.py — Multi-site Player Mode automated E2E runner.

Loop: discover -> plan (contract) -> do -> verify (subagent) -> refine.
Stop: all AC pass OR max_iterations reached.

Usage:
  uv run --python 3.11 --with nodriver python -u .agents/skills/testing-extension-browser/script/test_player_mode_flow.py

Requires:
  - npx vite build --mode development (extension in dist/)
  - nodriver + Chrome
"""

import argparse
import asyncio
import importlib.util
import json
import os
import shutil
import sys
import time
import uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import nodriver as uc

# Import helpers from the loader script by file path (filename has hyphens)
SCRIPT_DIR = Path(__file__).resolve().parent
LOADER_PATH = SCRIPT_DIR / "test-cell-browser.py"
spec = importlib.util.spec_from_file_location("test_cell_browser", str(LOADER_PATH))
loader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loader)
CHROME_EXE = loader.CHROME_EXE
CELL_EXT = loader.CELL_EXT
clone_master = loader.clone_master
cleanup_clone = loader.cleanup_clone
load_extension = loader.load_extension

# --- Config ---
TEMP_DIR = Path(os.environ.get("TEMP", "/tmp"))


@dataclass
class SiteConfig:
    name: str
    url: str
    kind: str  # "top" or "child"
    play_selector: Optional[str] = None  # fallback; we try to start the video
    pm_click: str = "shadow"  # "shadow" for top, "iframe" for child
    exit_click: str = "shadow"
    pm_clicks: List[Tuple[float, float]] = None  # relative coords inside iframe (offset_x, dy)


SITES: List[SiteConfig] = [
    SiteConfig(
        name="kisskh-top",
        url="https://kisskh.co/Drama/Perfect-Crown/Episode-1?id=11923&ep=207851&page=0&pageSize=100",
        kind="top",
    ),
    SiteConfig(
        name="animekai-child",
        url="https://animekai.be/watch/i-made-friends-with-the-second-prettiest-girl-in-my-class/ep-1",
        kind="child",
        pm_clicks=[(0.94, 55), (0.92, 65), (0.95, 75), (0.9, 45), (0.96, 85), (0.94, 35)],
    ),
    SiteConfig(
        name="moviepire-child",
        url="https://moviepire.ru/watch/125988?s=1&e=2&me=10",
        kind="child",
        pm_clicks=[(0.94, 55), (0.92, 65), (0.95, 75), (0.9, 45), (0.96, 85), (0.94, 35)],
    ),
    SiteConfig(
        name="themoviebox-top",
        url="https://themoviebox.xyz/movies/oh-boy-was-i-wrong-about-her-KZp0CGxDxI2?id=2281575019673174328&type=/movie/detail&detailSe=&detailEp=&lang=en",
        kind="top",
    ),
]


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


async def build() -> None:
    log("Building extension (dev mode)...")
    ret = os.system(r'cd "C:\Users\The0cean\Programming\The0cean ecosystem\cell" && npx vite build --mode development')
    if ret != 0:
        raise RuntimeError("Build failed")


async def launch_browser() -> Tuple[uc.Browser, Path]:
    clone_dir = clone_master()
    config = uc.Config(
        user_data_dir=str(clone_dir),
        headless=False,
        lang="en-US",
        browser_executable_path=CHROME_EXE,
    )
    browser = await uc.start(config)
    await asyncio.sleep(2)
    await load_extension(browser, CELL_EXT, "Cell (Video Downloader)")
    await asyncio.sleep(1)
    return browser, clone_dir


async def click(tab: uc.Tab, x: float, y: float) -> None:
    await tab.send(uc.cdp.input_.dispatch_mouse_event(type_="mousePressed", x=x, y=y, button=uc.cdp.input_.MouseButton.LEFT, click_count=1))
    await tab.send(uc.cdp.input_.dispatch_mouse_event(type_="mouseReleased", x=x, y=y, button=uc.cdp.input_.MouseButton.LEFT, click_count=1))


async def eval_top(tab: uc.Tab, expr: str) -> Any:
    try:
        return await tab.evaluate(expr, await_promise=False)
    except Exception as e:
        log(f"Eval error: {e}")
        return None


async def start_video(tab: uc.Tab, site: SiteConfig) -> bool:
    log(f"[{site.name}] Starting video...")
    if site.kind == "child":
        # Click center of the iframe to start the provider's player
        iframe_rect = await get_iframe_rect(tab)
        if iframe_rect:
            x = iframe_rect["left"] + iframe_rect["width"] * 0.5
            y = iframe_rect["top"] + iframe_rect["height"] * 0.5
            for _ in range(2):
                log(f"[{site.name}] Clicking iframe center ({x}, {y})")
                await click(tab, x, y)
                await asyncio.sleep(2)
                fs = await eval_top(tab, "JSON.stringify({isFullscreen: !!document.fullscreenElement})")
                if fs and '"isFullscreen":true' in str(fs):
                    # Sometimes click starts provider fullscreen, exit it
                    log(f"[{site}] Provider fullscreen started, exiting")
                    await click(tab, x, y)  # click again might exit or Esc
                    await asyncio.sleep(1)
                    await tab.send(uc.cdp.input_.dispatch_key_event(type_="keyDown", code="Escape", key="Escape"))
                    await tab.send(uc.cdp.input_.dispatch_key_event(type_="keyUp", code="Escape", key="Escape"))
                    await asyncio.sleep(1)
                else:
                    return True
    for _ in range(3):
        try:
            res_str = await eval_top(tab, """
                (function() {
                    const v = document.querySelector('video');
                    if (!v) return JSON.stringify({ok: false, reason: 'no video'});
                    v.click();
                    v.play().catch(function(){});
                    return JSON.stringify({ok: !v.paused, paused: v.paused, currentTime: v.currentTime});
                })()
            """)
            res = json.loads(res_str) if isinstance(res_str, str) else res_str
            log(f"[{site.name}] start_video: {res}")
            if res and res.get('ok'):
                return True
        except Exception as e:
            log(f"[{site.name}] start video error: {e}")
        await asyncio.sleep(2)
    return False


async def click_player_mode_shadow(tab: uc.Tab, action: str = "enter") -> bool:
    log(f"Clicking Player Mode ({action}) via shadow root...")
    data_cell = "player-mode-btn" if action == "enter" else "player-mode-exit-btn"
    res = await eval_top(tab, f"""
        (function() {{
            const root = document.querySelector('#cell-subtitle-root');
            if (!root || !root.shadowRoot) return 'no shadow root';
            const btn = root.shadowRoot.querySelector('[data-cell-id="{data_cell}"]');
            if (btn) {{ btn.click(); return 'clicked {data_cell}'; }}
            const labels = Array.from(root.shadowRoot.querySelectorAll('button'));
            const target = labels.find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('{action}'));
            if (target) {{ target.click(); return 'clicked by label'; }}
            return 'not found';
        }})()
    """)
    log(f"Shadow click result: {res}")
    return res and 'not found' not in str(res)


async def get_iframe_rect(tab: uc.Tab) -> Optional[Dict[str, float]]:
    res = await eval_top(tab, """
        (function() {
            const iframe = document.querySelector('iframe');
            if (!iframe) return null;
            const r = iframe.getBoundingClientRect();
            return JSON.stringify({ top: r.top, left: r.left, width: r.width, height: r.height, src: iframe.src });
        })()
    """)
    if isinstance(res, str):
        try:
            return json.loads(res)
        except json.JSONDecodeError:
            return None
    return res


async def click_player_mode_iframe(tab: uc.Tab, clicks: List[Tuple[float, float]]) -> bool:
    log("Clicking Player Mode inside child iframe (heuristic)...")
    iframe_rect = await get_iframe_rect(tab)
    if not iframe_rect:
        log("No iframe found")
        return False
    log(f"Iframe rect: {iframe_rect}")
    for offset, dy in clicks:
        x = iframe_rect["left"] + iframe_rect["width"] * offset
        y = iframe_rect["top"] + iframe_rect["height"] - dy
        log(f"Clicking ({x}, {y}) offset={offset} dy={dy}")
        await click(tab, x, y)
        await asyncio.sleep(2)
        fs = await eval_top(tab, "JSON.stringify({isFullscreen: !!document.fullscreenElement, el: document.fullscreenElement?.tagName + '#' + (document.fullscreenElement?.id || '')})")
        if fs and '"isFullscreen":true' in str(fs):
            log(f"Fullscreen activated at offset {offset} dy={dy}: {fs}")
            return True
    log("No fullscreen detected after iframe clicks")
    return False


async def click_exit_iframe(tab: uc.Tab) -> bool:
    # For child frame, exit button is at bottom-right of dock in fullscreen.
    # Use full viewport coordinate heuristic.
    log("Clicking exit in child iframe fullscreen...")
    for x, y in [(2520, 1410), (2500, 1360), (2540, 1400)]:
        await click(tab, x, y)
        await asyncio.sleep(2)
        fs = await eval_top(tab, "JSON.stringify({isFullscreen: !!document.fullscreenElement})")
        if fs and '"isFullscreen":false' in str(fs):
            log(f"Exit succeeded at ({x}, {y})")
            return True
    return False


async def test_site(browser: uc.Browser, site: SiteConfig, iteration: int, run_id: str) -> Dict[str, Any]:
    tab = await browser.get(site.url)
    await asyncio.sleep(8)  # wait for page + extension

    result: Dict[str, Any] = {"site": site.name, "iteration": iteration, "url": site.url, "pass": False, "screenshots": {}}

    # Start video
    started = await start_video(tab, site)
    if not started:
        log(f"[{site.name}] Could not start video, continuing anyway...")

    # Wait for Cell overlay
    await asyncio.sleep(3)
    has_root_str = await eval_top(tab, "(function(){ return JSON.stringify(!!(document.querySelector('#cell-subtitle-root')?.shadowRoot)); })()")
    has_root = json.loads(has_root_str) if isinstance(has_root_str, str) else has_root_str
    result["has_root"] = has_root

    # Before PM screenshot
    before = TEMP_DIR / f"{run_id}_{site.name}_before.png"
    await tab.save_screenshot(str(before))
    result["screenshots"]["before"] = str(before)

    # Enter PM
    if site.kind == "top":
        entered = await click_player_mode_shadow(tab, "enter")
    else:
        entered = await click_player_mode_iframe(tab, site.pm_clicks or [(0.95, 75)])
    result["entered"] = entered

    await asyncio.sleep(5)

    # After PM evidence
    after_ev = await eval_top(tab, """
        (function() {
            const fs = document.fullscreenElement;
            const overlay = document.querySelector('#cell-subtitle-root')?.shadowRoot?.querySelector('[data-cell-id="player-mode-overlay"]');
            const video = document.querySelector('video');
            return JSON.stringify({
                isFullscreen: !!fs,
                fullscreenElement: fs ? fs.tagName + '#' + (fs.id || '') : null,
                overlayVisible: !!overlay,
                videoPaused: video ? video.paused : null,
                videoCurrentTime: video ? video.currentTime : null
            });
        })()
    """)
    result["after_evidence"] = json.loads(after_ev) if isinstance(after_ev, str) and after_ev.startswith('{') else after_ev

    after = TEMP_DIR / f"{run_id}_{site.name}_after.png"
    await tab.save_screenshot(str(after))
    result["screenshots"]["after"] = str(after)

    # Exit PM
    if site.kind == "top":
        exited = await click_player_mode_shadow(tab, "exit")
    else:
        exited = await click_exit_iframe(tab)
    result["exited"] = exited

    await asyncio.sleep(3)

    # Exit evidence
    exit_ev = await eval_top(tab, """
        (function() {
            const fs = document.fullscreenElement;
            const overlay = document.querySelector('#cell-subtitle-root')?.shadowRoot?.querySelector('[data-cell-id="player-mode-overlay"]');
            const video = document.querySelector('video');
            return JSON.stringify({
                isFullscreen: !!fs,
                overlayVisible: !!overlay,
                videoPaused: video ? video.paused : null,
                videoCurrentTime: video ? video.currentTime : null
            });
        })()
    """)
    result["exit_evidence"] = json.loads(exit_ev) if isinstance(exit_ev, str) and exit_ev.startswith('{') else exit_ev

    exit_ss = TEMP_DIR / f"{run_id}_{site.name}_after_exit.png"
    await tab.save_screenshot(str(exit_ss))
    result["screenshots"]["after_exit"] = str(exit_ss)

    # Basic pass criteria
    after_fs = result.get("after_evidence", {}).get("isFullscreen") if isinstance(result.get("after_evidence"), dict) else False
    after_overlay = result.get("after_evidence", {}).get("overlayVisible") if isinstance(result.get("after_evidence"), dict) else False
    result["pass"] = entered and (after_fs or after_overlay) and exited

    return result


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-iterations", type=int, default=2)
    parser.add_argument("--sites", type=str, default="", help="comma-separated site names")
    args = parser.parse_args()

    await build()

    selected_sites = SITES
    if args.sites:
        names = set(args.sites.split(","))
        selected_sites = [s for s in SITES if s.name in names]

    run_id = f"pm_{int(time.time())}"
    report_path = TEMP_DIR / f"{run_id}_report.json"

    browser: Optional[uc.Browser] = None
    clone_dir: Optional[Path] = None
    all_results: List[Dict[str, Any]] = []

    try:
        browser, clone_dir = await launch_browser()

        for iteration in range(1, args.max_iterations + 1):
            log(f"=== Iteration {iteration}/{args.max_iterations} ===")
            iteration_results: List[Dict[str, Any]] = []
            for site in selected_sites:
                try:
                    res = await test_site(browser, site, iteration, run_id)
                    iteration_results.append(res)
                except Exception as e:
                    log(f"[{site.name}] Test failed: {e}")
                    iteration_results.append({"site": site.name, "iteration": iteration, "error": str(e), "pass": False})

            all_results.extend(iteration_results)

            # Save partial report
            with open(report_path, 'w') as f:
                json.dump({"run_id": run_id, "results": all_results}, f, indent=2)

            # Check stop condition
            all_pass = all(r.get("pass") for r in iteration_results)
            if all_pass:
                log(f"All sites passed on iteration {iteration}. Stopping.")
                break
            else:
                failed = [r["site"] for r in iteration_results if not r.get("pass")]
                log(f"Failed sites: {failed}. Refine needed.")

        log(f"Report saved: {report_path}")

    finally:
        if browser:
            browser.stop()
        await asyncio.sleep(2)
        if clone_dir and clone_dir.exists():
            shutil.rmtree(clone_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
