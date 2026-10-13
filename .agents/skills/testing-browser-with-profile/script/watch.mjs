import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { requireSession } from './session.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '../../../..');
const session = requireSession();
const PORT = String(session.port);
const LOG_DIR = path.join(ROOT, 'tmp', session.out);
const LOG = path.join(LOG_DIR, 'console.jsonl');
const CDP_HTTP = `http://127.0.0.1:${PORT}`;

fs.mkdirSync(LOG_DIR, { recursive: true });
const log = (o) =>
  fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...o }) + '\n');

let id = 0;
const send = (ws, method, params, sessionId) =>
  ws.send(JSON.stringify({ id: ++id, sessionId, method, params }));

async function connect() {
  let wsUrl;
  try {
    wsUrl = (await (await fetch(CDP_HTTP + '/json/version')).json()).webSocketDebuggerUrl;
  } catch {
    return setTimeout(connect, 3000);
  }
  const sessions = new Map();
  const ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    log({ k: 'watch-connected' });
    send(ws, 'Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  };
  ws.onclose = () => {
    log({ k: 'watch-disconnected' });
    setTimeout(connect, 3000);
  };
  ws.onerror = () => {};
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    const tgt = (sid) => sessions.get(sid)?.url?.slice(0, 200);
    if (m.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = m.params;
      sessions.set(sessionId, targetInfo);
      log({ k: 'attach', type: targetInfo.type, url: targetInfo.url?.slice(0, 200) });
      send(ws, 'Runtime.enable', undefined, sessionId);
      send(ws, 'Log.enable', undefined, sessionId);
    } else if (m.method === 'Target.detachedFromTarget') {
      sessions.delete(m.params.sessionId);
    } else if (m.method === 'Runtime.consoleAPICalled') {
      const text = m.params.args
        .map((a) => a.value ?? a.description ?? String(a.type))
        .join(' ')
        .slice(0, 3000);
      log({ k: 'console', type: m.params.type, tgt: tgt(m.sessionId), text });
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      log({
        k: 'exception',
        tgt: tgt(m.sessionId),
        text: `${d.text} ${d.exception?.description ?? ''}`.slice(0, 4000),
        stack: d.stackTrace?.callFrames?.slice(0, 8),
      });
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      log({ k: 'log', level: e.level, src: e.source, tgt: tgt(m.sessionId), text: String(e.text).slice(0, 2000), url: e.url?.slice(0, 300) });
    }
  };
}

connect();
