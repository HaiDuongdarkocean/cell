export const name = 'pronunciation-espeak';

export async function run(ctx) {
  const { rdp, extensionId } = ctx;

  const found = await rdp.findAnyContentScript(extensionId, 30000);
  if (!found) return { pass: false, detail: 'no content script available as bg pipe' };
  await rdp.installSendBg(found.consoleActor);

  const res = await rdp.evalAsync(
    found.consoleActor,
    `__sendBg({ type: 'PRONUNCIATION_ESPEAK_TTS', payload: { text: 'hello world', langCode: 'en' } }).then((v) => {
      const bytes = v?.data?.audioBytes ?? v?.data?.audio;
      const len = bytes == null ? 0 : (typeof bytes.byteLength === 'number' ? bytes.byteLength : typeof bytes.length === 'number' ? bytes.length : Object.keys(bytes).length);
      return { ok: v?.success, len, err: v?.error };
    }).catch((e) => ({ err: String(e && e.message || e) }))`,
    120000,
  );
  console.log(`  espeak: ${JSON.stringify(res)}`);
  if (!res?.ok) return { pass: false, detail: `PRONUNCIATION_ESPEAK_TTS failed: ${res?.err ?? 'unknown'}` };
  if (!(res.len > 10000)) return { pass: false, detail: `suspicious WAV size ${res.len}` };
  return { pass: true, detail: `WAV ${res.len} bytes` };
}
