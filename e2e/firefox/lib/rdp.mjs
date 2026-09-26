import { connect } from 'node:net';

export class RdpClient {
  constructor(sock) {
    this.sock = sock;
    this.buffer = Buffer.alloc(0);
    this.waiters = new Map();
    this.evalResults = new Map();
    this.evalWaiters = new Map();
    this.targetForms = [];
    this.slot = 0;
    sock.on('data', (d) => {
      this.buffer = Buffer.concat([this.buffer, d]);
      this.pump();
    });
  }

  static async connect(port, host = '127.0.0.1') {
    const sock = await new Promise((resolve, reject) => {
      const s = connect(port, host, () => resolve(s));
      s.on('error', reject);
    });
    const client = new RdpClient(sock);
    await sleep(300);
    return client;
  }

  route(p) {
    if (p.type === 'target-available-form' || p.type === 'target-destroyed-form') {
      this.targetForms.push(p);
      return;
    }
    if (p.type === 'evaluationResult' && p.resultID) {
      if (this.evalWaiters.has(p.resultID)) return this.evalWaiters.get(p.resultID)(p);
      this.evalResults.set(p.resultID, p);
      return;
    }
    const key = p.to ?? p.from ?? 'root';
    const list = this.waiters.get(key);
    if (list?.length) list.shift()(p);
  }

  pump() {
    for (;;) {
      const s = this.buffer.indexOf(':');
      if (s < 0) return;
      const n = Number(this.buffer.subarray(0, s).toString('ascii'));
      if (!Number.isFinite(n) || this.buffer.length < s + 1 + n) return;
      const j = this.buffer.subarray(s + 1, s + 1 + n).toString('utf8');
      this.buffer = this.buffer.subarray(s + 1 + n);
      try {
        this.route(JSON.parse(j));
      } catch {}
    }
  }

  sendTo(to, packet, ms = 20000) {
    return new Promise((res) => {
      const m = JSON.stringify({ to, ...packet });
      const list = this.waiters.get(to) ?? [];
      list.push(res);
      this.waiters.set(to, list);
      this.sock.write(`${Buffer.byteLength(m)}:${m}`);
      setTimeout(() => res({ __timeout: true }), ms);
    });
  }

  async evalOn(actor, text, ms = 30000) {
    const r = await this.sendTo(actor, { type: 'evaluateJSAsync', text, eager: false }, ms);
    if (r.error || !r.resultID) return r;
    const rid = r.resultID;
    if (this.evalResults.has(rid)) return this.evalResults.get(rid);
    return new Promise((res) => {
      this.evalWaiters.set(rid, res);
      setTimeout(() => res({ __timeout: true, rid }), ms);
    });
  }

  async evalAsync(actor, expr, ms = 60000) {
    const slot = `__rdp${this.slot++}`;
    await this.evalOn(
      actor,
      `globalThis.${slot} = undefined; Promise.resolve(${expr}).then(
        (v) => { globalThis.${slot} = { done: 1, s: JSON.stringify(v) }; },
        (e) => { globalThis.${slot} = { done: 1, s: JSON.stringify({ err: String(e && e.message || e) }) }; }
      ); 'armed'`,
      15000,
    );
    const deadline = Date.now() + ms;
    for (;;) {
      const r = unwrap(await this.evalOn(actor, `globalThis.${slot}`, 15000));
      if (r && r.done) {
        try {
          return JSON.parse(r.s);
        } catch {
          return r.s;
        }
      }
      if (Date.now() > deadline) return { timeout: true };
      await sleep(500);
    }
  }

  liveTargets() {
    const dead = new Set(this.targetForms.filter((f) => f.type === 'target-destroyed-form').map((f) => f.target.actor));
    return this.targetForms
      .filter((f) => f.type === 'target-available-form')
      .map((f) => f.target)
      .filter((t) => !dead.has(t.actor));
  }

  async listTabs() {
    const { tabs } = await this.sendTo('root', { type: 'listTabs' });
    return tabs ?? [];
  }

  async findTab(urlIncludes) {
    const tabs = await this.listTabs();
    return tabs.find((t) => String(t.url || '').includes(urlIncludes)) ?? null;
  }

  async findContentScript(urlIncludes, extensionId, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const tab = await this.findTab(urlIncludes);
      if (tab) {
        const w = await this.sendTo(tab.actor, { type: 'getWatcher' });
        const watcher = w.actor ?? w.watcherActor;
        if (watcher) {
          await this.sendTo(watcher, { type: 'watchTargets', targetType: 'content_script' });
          await sleep(2500);
          const scripts = this.liveTargets().filter((t) => t.targetType === 'content_script' && t.consoleActor);
          for (const cs of scripts) {
            const info = unwrap(
              await this.evalOn(
                cs.consoleActor,
                `(() => { try { return { id: chrome.runtime.id, top: window === window.top, url: location.href }; } catch (e) { return { err: String(e) }; } })()`,
              ),
            );
            if (info?.id === extensionId && info?.top && String(info.url).includes(urlIncludes)) {
              return { cs, tab, consoleActor: cs.consoleActor };
            }
          }
        }
      }
      await sleep(1500);
    }
    return null;
  }

  async findAnyContentScript(extensionId, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const tabs = await this.listTabs();
      for (const tab of tabs) {
        const w = await this.sendTo(tab.actor, { type: 'getWatcher' });
        const watcher = w.actor ?? w.watcherActor;
        if (watcher) await this.sendTo(watcher, { type: 'watchTargets', targetType: 'content_script' });
      }
      await sleep(2500);
      const scripts = this.liveTargets().filter((t) => t.targetType === 'content_script' && t.consoleActor);
      for (const cs of scripts) {
        const info = unwrap(
          await this.evalOn(
            cs.consoleActor,
            `(() => { try { return { id: chrome.runtime.id, top: window === window.top, url: location.href }; } catch (e) { return { err: String(e) }; } })()`,
          ),
        );
        if (info?.id === extensionId && info?.top) return { cs, consoleActor: cs.consoleActor };
      }
      await sleep(1500);
    }
    return null;
  }

  async waitForAddon(extensionId, timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const { addons } = await this.sendTo('root', { type: 'listAddons' });
      const addon = (addons ?? []).find((a) => a.id === extensionId);
      if (addon) return addon;
      await sleep(1000);
    }
    return null;
  }

  async getBackgroundConsole(addon, timeoutMs = 30000) {
    const w = await this.sendTo(addon.actor, { type: 'getWatcher' });
    const watcher = w.actor ?? w.watcherActor;
    if (!watcher) return null;
    await this.sendTo(watcher, { type: 'watchTargets', targetType: 'frame' });
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const bg = this.liveTargets().find((t) => String(t.url || '').includes('background'));
      if (bg) {
        const att = await this.sendTo(bg.actor, { type: 'attach' });
        const consoleActor = att.consoleActor ?? bg.consoleActor;
        if (consoleActor) return consoleActor;
      }
      await sleep(1500);
    }
    return null;
  }

  async installSendBg(consoleActor) {
    await this.evalOn(
      consoleActor,
      `globalThis.__sendBg = globalThis.__sendBg || ((req) => new Promise((resolve, reject) => {
        const attempt = (n) => chrome.runtime.sendMessage(req).then(resolve).catch((e) => {
          if (n > 0) return setTimeout(() => attempt(n - 1), 1000);
          reject(e);
        });
        attempt(3);
      })); 'ok'`,
    );
  }

  close() {
    this.sock.end();
  }
}

export function unwrap(r) {
  const res = r?.result ?? r;
  if (res?.preview?.ownProperties) {
    const out = {};
    for (const [k, d] of Object.entries(res.preview.ownProperties)) {
      out[k] = 'value' in d ? d.value : 'grip:' + (d.type ?? '?');
    }
    return out;
  }
  return res;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
