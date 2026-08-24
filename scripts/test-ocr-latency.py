"""test-ocr-latency.py — Capture console.log from OCR pipeline. Simple."""
import asyncio, json, shutil, uuid, re
from pathlib import Path
import nodriver as uc

CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SESSION_ROOT = Path(r"C:\stealth-mcp-browser-sessions")
MASTER_PROFILE = SESSION_ROOT / "master"
SESSIONS_DIR = SESSION_ROOT / "sessions"
CELL_EXT = r"C:\Users\The0cean\Programming\The0cean ecosystem\cell\dist"
MOCK_URL = "http://127.0.0.1:4325/"

# Cues from hardSubMockMain.ts
CUES = [(0,"Hello World"),(3,"我喜欢"),(6,"日本語を勉強する"),(9,"我喜欢"),(12,"東京"),(15,"Hello"),(18,"WiFi"),(21,"你好世界")]

def clone_master():
    d = SESSIONS_DIR / f"cell-lat-{uuid.uuid4().hex[:12]}"
    d.mkdir(parents=True, exist_ok=True)
    sd, dd = MASTER_PROFILE / "Default", d / "Default"
    dd.mkdir(exist_ok=True)
    keep = {"Cookies","Cookies-journal","Login Data","Login Data-journal","Web Data","Web Data-journal","Preferences","Secure Preferences","Local Storage","Session Storage","Extension State"}
    if sd.exists():
        for item in sd.iterdir():
            if item.name in keep:
                if item.is_dir(): shutil.copytree(item, dd/item.name, dirs_exist_ok=True, ignore=shutil.ignore_patterns("LOCK"))
                else: shutil.copy2(item, dd/item.name)
    for f in {"Local State","First Party Sets","first_party_sets.db"}:
        s = MASTER_PROFILE / f
        if s.exists(): shutil.copy2(s, d / f)
    return d

async def main():
    clone = clone_master()
    print(f"[OK] Clone: {clone}")
    browser = await uc.start(headless=False, browser_executable_path=CHROME_EXE, user_data_dir=str(clone))
    r = await browser.send(uc.cdp.extensions.load_unpacked(path=CELL_EXT))
    print(f"[OK] Cell: {r if isinstance(r,str) else getattr(r,'id',r)}")
    tab = await browser.get(MOCK_URL)
    await tab.sleep(3)

    # Collect console logs via CDP
    logs = []
    async def on_console(event, conn):
        try:
            # ConsoleAPICalled has .args (list of RemoteObject) and .type
            args = event.args
            text = ' '.join(str(a.value or a.description or '') for a in args)
            if '[OCR]' in text or '[PaddleOcrEngine]' in text or '[OCR_BG]' in text:
                logs.append((asyncio.get_event_loop().time(), text))
        except:
            pass

    tab.add_handler(uc.cdp.runtime.ConsoleAPICalled, on_console)

    # Enable runtime to receive console events
    await tab.send(uc.cdp.runtime.enable())
    print("[OK] Runtime enabled")

    # Play with loop + trigger OCR
    await tab.evaluate("document.querySelector('video').muted=true; document.querySelector('video').loop=true; document.querySelector('video').play();")
    await tab.evaluate("window.postMessage({type:'__CELL_OCR_DEBUG_INIT',origin:'127.0.0.1',languageMode:'auto'},'*');")
    print("[OK] Playing (loop) + OCR init. Waiting 40s for 2 loops...")
    await tab.sleep(40)

    browser.stop()

    # Parse [OCR] logs: "[OCR] t=3.05s text=["我喜欢"] hitboxes=1"
    ocr_events = []
    for wall_t, msg in logs:
        m = re.search(r'\[OCR\] t=([\d.]+)s text=(.+?) hitboxes=(\d+)', msg)
        if m:
            vt = float(m.group(1))
            text_raw = m.group(2)
            hb_count = int(m.group(3))
            ocr_events.append((wall_t, vt, text_raw, hb_count))

    print(f"\n[OK] Captured {len(logs)} console logs, {len(ocr_events)} OCR events")

    # Print all OCR events
    print("\nOCR EVENTS (console.log):")
    print(f"{'wall':>8}s | {'video':>8}s | {'text':>30} | hitboxes")
    print("-" * 70)
    for wall_t, vt, text, hb in ocr_events:
        print(f"{wall_t:>8.2f} | {vt:>8.2f} | {text:>30} | {hb}")

    # Compute latency: for each cue, find first OCR event with matching text AFTER video crosses cue start
    # We need video time tracking too — use the wall_t of OCR event + video time
    print("\n" + "=" * 75)
    print("LATENCY: cue.start → OCR overlay (from console.log timestamps)")
    print("=" * 75)
    print(f"{'Cue':>5}s | {'Text':>18} | {'Delay(ms)':>10} | {'Video Δt':>8} | Status")
    print("-" * 75)

    # We need to know when video crossed each cue_start.
    # Approximate: OCR event at video_time T means pipeline ran at T.
    # Subtitle appears at cue_start. First OCR with matching text AFTER cue_start = overlay time.
    # Delay = (wall_t of that OCR event) - (wall_t when video was at cue_start)
    # We can estimate wall_t at cue_start by interpolating between OCR events.

    delays = []
    for cue_start, expected in CUES:
        # Find first OCR event where video_time >= cue_start AND text contains expected
        matched = None
        for wall_t, vt, text_raw, hb in ocr_events:
            if vt >= cue_start and expected in text_raw:
                matched = (wall_t, vt, text_raw)
                break

        if matched:
            # Estimate wall_t when video was at cue_start:
            # Find OCR event just before cue_start
            prev_event = None
            for wall_t, vt, text_raw, hb in ocr_events:
                if vt <= cue_start:
                    prev_event = (wall_t, vt)
                else:
                    break

            if prev_event:
                # Linear interpolation: wall_t_at_cue = prev_wall + (cue_start - prev_vt) * (matched_wall - prev_wall) / (matched_vt - prev_vt)
                prev_wall, prev_vt = prev_event
                matched_wall, matched_vt, _ = matched
                if matched_vt > prev_vt:
                    wall_at_cue = prev_wall + (cue_start - prev_vt) * (matched_wall - prev_wall) / (matched_vt - prev_vt)
                    delay = round((matched_wall - wall_at_cue) * 1000)
                    vdt = round(matched_vt - cue_start, 2)
                    delays.append(delay)
                    print(f"{cue_start:>5} | {expected:>18} | {delay:>10} | {vdt:>7}s | OK")
                else:
                    print(f"{cue_start:>5} | {expected:>18} | {'—':>10} | {'—':>8} | cannot interpolate")
            else:
                print(f"{cue_start:>5} | {expected:>18} | {'—':>10} | {'—':>8} | no prior event")
        else:
            print(f"{cue_start:>5} | {expected:>18} | {'—':>10} | {'—':>8} | no match")

    print("-" * 75)
    if delays:
        import statistics
        print(f"Min: {min(delays)}ms | Max: {max(delays)}ms | Avg: {round(statistics.mean(delays))}ms | Median: {round(statistics.median(delays))}ms | N={len(delays)}")
    else:
        print("No measurements.")

    # Save raw logs
    Path(clone / "ocr_console_logs.txt").write_text('\n'.join(f"{wt:.3f} {m}" for wt, m in logs))
    print(f"\n[OK] Logs saved: {clone / 'ocr_console_logs.txt'}")

if __name__ == "__main__":
    asyncio.run(main())
