export const name = 'cardcreator-ankiconnect';

const PROBE_DECK = '__TihokaE2EProbe__';
const PROBE_MEDIA = 'Tihoka-e2e-probe.wav';

async function invoke(rdp, actor, action, params) {
  return rdp.evalAsync(
    actor,
    `__sendBg({ type: 'CARD_CREATOR_REQUEST', payload: { url: 'http://127.0.0.1:8765', action: ${JSON.stringify(action)}, params: ${JSON.stringify(params ?? {})} } })
      .then((v) => ({ ok: v?.success, result: v?.data?.result ?? null, err: v?.error ?? null }))
      .catch((e) => ({ err: String(e && e.message || e) }))`,
    30000,
  );
}

export async function run(ctx) {
  const { rdp, extensionId } = ctx;

  const found = await rdp.findAnyContentScript(extensionId, 30000);
  if (!found) return { pass: false, detail: 'no content script available as bg pipe' };
  await rdp.installSendBg(found.consoleActor);

  const version = await invoke(rdp, found.consoleActor, 'version');
  console.log(`  anki version: ${JSON.stringify(version)}`);
  if (!version.ok || version.result !== 6) {
    return { skipped: true, detail: `AnkiConnect not live at 127.0.0.1:8765 (${version.err ?? JSON.stringify(version)})` };
  }

  const deck = await invoke(rdp, found.consoleActor, 'createDeck', { deck: PROBE_DECK });
  if (!deck.ok) return { pass: false, detail: `createDeck failed: ${deck.err}` };

  try {
    const models = await invoke(rdp, found.consoleActor, 'modelNames');
    const modelName = models.result?.[0];
    if (!modelName) return { pass: false, detail: `modelNames empty: ${JSON.stringify(models)}` };
    const fieldNames = await invoke(rdp, found.consoleActor, 'modelFieldNames', { modelName });
    const fields = Object.fromEntries((fieldNames.result ?? []).map((f, i) => [f, i === 0 ? 'Tihoka-e2e-probe' : 'firefox-live']));
    if (!fields || Object.keys(fields).length === 0) {
      return { pass: false, detail: `modelFieldNames empty for ${modelName}` };
    }

    const note = await invoke(rdp, found.consoleActor, 'addNote', {
      note: {
        deckName: PROBE_DECK,
        modelName,
        fields,
        options: { allowDuplicate: true },
        tags: ['Tihoka-e2e'],
      },
    });
    console.log(`  addNote: ${JSON.stringify(note)}`);
    if (!note.ok || typeof note.result !== 'number') {
      return { pass: false, detail: `addNote failed: ${note.err ?? JSON.stringify(note)}` };
    }

    const wav = Buffer.concat([
      Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WAVEfmt ', 'ascii'),
      Buffer.from([16, 0, 0, 0, 1, 0, 1, 0, 0x40, 0x1f, 0, 0, 0x80, 0x3e, 0, 0, 2, 0, 16, 0]),
      Buffer.from('data', 'ascii'), Buffer.from([8, 0, 0, 0]), Buffer.alloc(8),
    ]).toString('base64');
    const media = await invoke(rdp, found.consoleActor, 'storeMediaFile', { filename: PROBE_MEDIA, data: wav });
    console.log(`  storeMediaFile: ${JSON.stringify(media)}`);
    if (!media.ok || media.result !== PROBE_MEDIA) {
      return { pass: false, detail: `storeMediaFile failed: ${media.err ?? JSON.stringify(media)}` };
    }

    return { pass: true, detail: `live AnkiConnect round-trip: version=6, model=${modelName}, noteId=${note.result}, media stored` };
  } finally {
    const cleanup = await invoke(rdp, found.consoleActor, 'multi', {
      actions: [
        { action: 'deleteDecks', params: { decks: [PROBE_DECK], cardsToo: true } },
        { action: 'deleteMediaFile', params: { filename: PROBE_MEDIA } },
      ],
    });
    console.log(`  cleanup: ${JSON.stringify(cleanup)}`);
  }
}
