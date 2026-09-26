export const name = 'ocr-opencv-wasm';

export async function run(ctx) {
  const { rdp, bgConsole } = ctx;
  if (!bgConsole) return { pass: false, detail: 'background console unavailable' };

  const res = await rdp.evalAsync(
    bgConsole,
    `(async () => {
      const mod = await import(chrome.runtime.getURL('assets/opencv.js'));
      const cv = mod.default ?? mod;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('cv runtime init timeout')), 45000);
        const done = () => { clearTimeout(timer); resolve(); };
        if (cv.then) cv.then(done); else if (cv.calledRun) done(); else cv.onRuntimeInitialized = done;
      });
      const mat = new cv.Mat(1, 1, cv.CV_8UC1);
      mat.delete();
      return { mat: typeof cv.Mat, cv8: typeof cv.CV_8UC1, imread: typeof cv.imread };
    })().catch((e) => ({ err: String(e && e.message || e) }))`,
    90000,
  );
  console.log(`  opencv: ${JSON.stringify(res)}`);
  if (res?.err) return { pass: false, detail: `opencv init failed: ${res.err}` };
  if (res.mat !== 'function' || res.cv8 !== 'number' || res.imread !== 'function') {
    return { pass: false, detail: `cv API unbound: ${JSON.stringify(res)}` };
  }
  return { pass: true, detail: 'external opencv.wasm instantiated; cv.Mat bound' };
}
