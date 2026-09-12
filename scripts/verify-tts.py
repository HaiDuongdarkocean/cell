import asyncio
import json
import os
import shutil
import tempfile
from pathlib import Path

import nodriver as uc

CELL_EXT = Path(__file__).resolve().parents[1] / "dist"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def decode(raw: object) -> dict:
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return {"raw": raw}
    if isinstance(raw, list):
        decoded: dict = {}
        for pair in raw:
            if isinstance(pair, list) and len(pair) == 2:
                k, v = pair
                decoded[k] = v.get("value") if isinstance(v, dict) else v
        return decoded
    if isinstance(raw, dict) and "value" in raw:
        try:
            return json.loads(raw["value"])
        except Exception:
            return dict(raw)
    if isinstance(raw, dict):
        return dict(raw)
    return {"raw": str(raw)}


async def load_extension(browser: uc.Browser, ext_path: Path) -> str:
    tmp = Path(tempfile.mkdtemp(prefix="cell-ext-"))
    try:
        shutil.copytree(ext_path, tmp, dirs_exist_ok=True)
        meta = tmp / "_metadata"
        if meta.exists():
            shutil.rmtree(meta, ignore_errors=True)
        result = await browser.send(uc.cdp.extensions.load_unpacked(path=str(tmp)))
        ext_id = result if isinstance(result, str) else getattr(result, "id", str(result))
        print(f"[TTS] Extension loaded: ID={ext_id}", flush=True)
        return ext_id
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        raise


async def main() -> None:
    if not CELL_EXT.exists():
        print(f"[FAIL] Extension dist not found: {CELL_EXT}", flush=True)
        return

    config = uc.Config(
        headless=False,
        lang="en-US",
        browser_executable_path=CHROME,
    )
    browser = await uc.start(config)
    try:
        ext_id = await load_extension(browser, CELL_EXT)
        url = f"chrome-extension://{ext_id}/public/options.html"
        tab = await browser.get(url, new_tab=False)

        for _ in range(30):
            await tab.sleep(1)
            raw = await tab.evaluate(
                'JSON.stringify({ hasApp: typeof window.appState !== "undefined", readyState: document.readyState, scripts: Array.from(document.querySelectorAll("script")).map(s => s.src || "inline"), buttons: !!document.getElementById("downloadBtn") })'
            )
            probe = decode(raw)
            print(f"[TTS] probe: {probe}", flush=True)
            if probe.get("hasApp"):
                break
        else:
            print("[TTS] appState not found — script did not load", flush=True)
            return
        print(f"[TTS] options page loaded: {url}", flush=True)

        await tab.evaluate('document.getElementById("downloadBtn").click()')
        print("[TTS] download clicked", flush=True)

        for i in range(120):  # up to 10 minutes
            await asyncio.sleep(5)
            raw = await tab.evaluate("JSON.stringify(window.appState)")
            state = decode(raw)
            status = state.get("downloadStatus", "")
            progress = state.get("progress", "")
            print(f"[{i + 1}] download={status} progress={progress}", flush=True)
            if status == "success":
                break
            if isinstance(status, str) and status.startswith("error"):
                print("[TTS] DOWNLOAD FAILED", state, flush=True)
                return
        else:
            print("[TTS] download timeout", flush=True)
            return

        await tab.evaluate('document.getElementById("speakBtn").click()')
        print("[TTS] speak clicked", flush=True)

        for i in range(60):  # up to 2 minutes
            await asyncio.sleep(2)
            raw = await tab.evaluate("JSON.stringify(window.appState)")
            state = decode(raw)
            speak_status = state.get("speakStatus", "")
            print(f"[speak {i + 1}] status={speak_status}", flush=True)
            if speak_status == "success":
                print("[TTS] SPEAK SUCCESS", flush=True)
                return
            if isinstance(speak_status, str) and speak_status.startswith("error"):
                print("[TTS] SPEAK FAILED", state, flush=True)
                return
        else:
            print("[TTS] speak timeout", flush=True)
    finally:
        try:
            await browser.send(uc.cdp.browser.close())
        except Exception:
            browser.stop()
        print("[TTS] browser closed", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
