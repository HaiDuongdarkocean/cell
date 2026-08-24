"""test-ocr-accuracy.py — Compare video cues vs OCR detected. Poll DOM dataset."""
import asyncio, json, shutil, uuid, statistics
from pathlib import Path
import nodriver as uc

CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SESSION_ROOT = Path(r"C:\stealth-mcp-browser-sessions")
MASTER_PROFILE = SESSION_ROOT / "master"
SESSIONS_DIR = SESSION_ROOT / "sessions"
CELL_EXT = r"C:\Users\The0cean\Programming\The0cean ecosystem\cell\dist"
MOCK_URL = "http://127.0.0.1:4325/"

CUES = [
    (0, 3, "Hello World"),
    (3, 6, "我喜欢北京"),
    (6, 9, "日本語を勉強する"),
    (9, 12, "我喜欢 watching movies"),
    (12, 15, "東京駅からTokyo Stationへ"),
    (15, 18, "Hello 世界"),
    (18, 21, "用WiFi看4K电影"),
    (21, 24, "你好👋World🌍"),
]

def clone_master():
    d = SESSIONS_DIR / f"cell-acc-{uuid.uuid4().hex[:12]}"
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

    # Play video with loop + trigger OCR init (engine loads while video plays)
    await tab.evaluate("document.querySelector('video').muted=true; document.querySelector('video').loop=true; document.querySelector('video').play();")
    await tab.evaluate("window.postMessage({type:'__CELL_OCR_DEBUG_INIT',origin:'127.0.0.1',languageMode:'auto'},'*');")
    print("[OK] Playing (loop) + OCR init. Waiting 30s for engine...")
    await tab.sleep(30)

    init = await tab.evaluate("document.body.dataset.ocrDebugStep || 'none'", return_by_value=True)
    print(f"[OK] OCR step: {init}. Recording 48s (2 loops, catch all 8 cues)...")

    # Poll every 200ms for 48s — 2 full loops to catch all 8 cues including cue 1
    samples = []
    for i in range(240):  # 48s at 200ms
        await asyncio.sleep(0.2)
        s = await tab.evaluate("""(() => {
            const v = document.querySelector('video');
            const ds = document.body.dataset;
            const hbs = Array.from(document.querySelectorAll('.cell-ocr-hitbox')).map(h => h.dataset.cellTerm);
            return JSON.stringify({
                t: v.currentTime,
                lastResult: ds.ocrLastResult || '',
                texts: hbs,
                pipeline: (ds.ocrPipelineStatuses || '').split(',').slice(-3).join(','),
                loopCount: ds.ocrLoopCount || '0',
                lastError: ds.ocrLastError || '',
                errors: ds.ocrErrors || '',
            });
        })()""", return_by_value=True)
        try:
            d = json.loads(s)
            samples.append((i * 0.2, d['t'], d['lastResult'], d.get('texts', []), d.get('pipeline', ''), d.get('loopCount', '0')))
        except:
            pass

    # Fetch error info before stopping browser
    err_info = await tab.evaluate("JSON.stringify({lastError: document.body.dataset.ocrLastError||'', errors: (document.body.dataset.ocrErrors||'').split('\\n').slice(-5), debugException: document.body.dataset.ocrDebugException||'', initError: document.body.dataset.ocrInitError||'', initResult: document.body.dataset.ocrInitResult||'', recognizeError: document.body.dataset.ocrRecognizeError||''})", return_by_value=True)

    browser.stop()

    print(f"\n[OK] {len(samples)} samples recorded")
    print(f"ERRORS: {err_info}")

    # Print samples where hitbox text is non-empty OR pipeline shows 'ocr'
    print("\nOCR Detections (hitbox text non-empty):")
    print(f"{'#':>3} | {'wall':>6}s | {'video':>6}s | {'hitbox_texts':>40} | {'pipeline':>30} | loop")
    print("-" * 110)
    detections = 0
    for i, (wall, vt, result, texts, pipeline, loop) in enumerate(samples):
        if texts or 'ocr' in pipeline:
            print(f"{i+1:>3} | {wall:>6.1f} | {vt:>6.2f} | {json.dumps(texts, ensure_ascii=False):>40} | {pipeline:>30} | {loop}")
            detections += 1
    if detections == 0:
        # Print last 5 samples to see what pipeline is doing
        print("  (no detections — showing last 5 samples for debug):")
        for i, (wall, vt, result, texts, pipeline, loop) in enumerate(samples[-5:]):
            print(f"  wall={wall:.1f} vt={vt:.2f} texts={texts} pipeline={pipeline} loop={loop}")

    # Compare: for each cue, did OCR detect matching text?
    print("\n" + "=" * 90)
    print("ACCURACY: 8 video cues vs OCR detected")
    print("=" * 90)
    print(f"{'#':>2} | {'Time':>8} | {'Cue text':>28} | {'Best OCR match':>28} | {'Match':>6}")
    print("-" * 90)

    matched_count = 0
    for i, (start, end, cue_text) in enumerate(CUES):
        best_match = None
        best_score = 0
        for wall, vt, result, texts, pipeline, loop in samples:
            vt_mod = vt % 24
            if start <= vt_mod < end:
                all_texts = texts + ([result] if result else [])
                for t in all_texts:
                    if not t:
                        continue
                    t_clean = t.strip('[]"').replace('\\n', '')
                    common = sum(1 for c in cue_text if c in t_clean)
                    score = common / max(len(cue_text), 1)
                    if score > best_score:
                        best_score = score
                        best_match = t_clean

        is_match = best_score >= 0.5
        if is_match:
            matched_count += 1
        print(f"{i+1:>2} | {start:>3}-{end:<3}s | {cue_text:>28} | {(best_match or '—'):>28} | {'YES' if is_match else 'NO':>6} ({round(best_score*100)}%)")

    print("-" * 90)
    print(f"Matched: {matched_count}/{len(CUES)} cues ({round(matched_count/len(CUES)*100)}%)")

    # Save
    Path(clone / "accuracy_results.json").write_text(json.dumps({
        'cues': [{'start': s, 'end': e, 'text': t} for s, e, t in CUES],
        'samples': [{'wall': w, 'video_t': vt, 'result': r, 'texts': ts, 'pipeline': p, 'loop': l} for w, vt, r, ts, p, l in samples],
        'matched_count': matched_count,
        'total_cues': len(CUES),
        'errors': err_info,
    }, indent=2, ensure_ascii=False))
    print(f"\n[OK] Results saved: {clone / 'accuracy_results.json'}")

if __name__ == "__main__":
    asyncio.run(main())
