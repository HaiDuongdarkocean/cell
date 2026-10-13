/* global chrome */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { requireSession } from './session.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '../../../..');
const CHUNK = 4 * 1024 * 1024;
const LANG = 'en';

const DEFAULT_FILES = [
  'data/resource/en/dictionary/tihoka format/COCA-60000.freq.json',
  'data/resource/en/dictionary/tihoka format/Macmillan-2Ed.tihoka.json',
  'data/resource/en/dictionary/tihoka format/Macmillan-EnEn.tihoka.json',
];
const statusOnly = process.argv.includes('--status');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = (args.length ? args : DEFAULT_FILES).map((f) => path.resolve(ROOT, f));

const session = requireSession();
await fetch(`http://127.0.0.1:${session.port}/json`);
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'manifest.json'), 'utf8'));
const digest = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest();
const extId = [...digest.subarray(0, 16)]
  .map((b) => String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 15)))
  .join('');

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${session.port}`);
const ctx = browser.contexts()[0];
const optionsUrl = `chrome-extension://${extId}/options.html`;

async function extPage() {
  const page = ctx.pages().find(
    (p) => !p.isClosed() && p.url().startsWith(`chrome-extension://${extId}/`),
  );
  if (page) return page;
  const fresh = await ctx.newPage();
  await fresh.goto(optionsUrl);
  return fresh;
}

const send = async (type, payload, tries = 4) => {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const page = await extPage();
      return await page.evaluate(
        ([t, p]) =>
          chrome.runtime.sendMessage({ type: t, payload: p }).then((r) => {
            if (!r?.success) throw new Error(r?.error ?? `${t} failed`);
            return r.data;
          }),
        [type, payload],
      );
    } catch (e) {
      lastErr = e;
      if (!/closed|crash|destroyed|detached|Target/i.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
};

const listJobs = () => send('JOB_LIST', {}).then((d) => d.jobs);
const listResources = () => send('RESOURCE_LIST', { langCode: LANG }).then((d) => d.resources);

if (statusOnly) {
  for (const j of await listJobs()) {
    console.log(`${j.kind} ${j.status} ${j.label} ${j.progress?.done ?? ''}/${j.progress?.total ?? ''} ${j.error ? JSON.stringify(j.error) : ''}`);
  }
  for (const r of await listResources()) {
    console.log(`resource: ${r.name} id=${r.id} enabled=${r.enabled} finished=${r.installationFinished}`);
  }
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadFile(file, jobId) {
  const name = path.basename(file);
  const b64 = fs.readFileSync(file).toString('base64');
  const total = Math.max(1, Math.ceil(b64.length / CHUNK));
  for (let seq = 0; seq < total; seq++) {
    await send('RESOURCE_IMPORT_CHUNK', {
      jobId,
      seq,
      total,
      data: b64.slice(seq * CHUNK, (seq + 1) * CHUNK),
      fileName: name,
      fileMime: 'application/json',
      langCode: LANG,
    });
    if (seq % 4 === 0 || seq === total - 1) process.stdout.write(`\r${name}: upload ${seq + 1}/${total}`);
  }
  process.stdout.write('\n');
}

async function waitJobs(ids) {
  const deadline = Date.now() + 15 * 60 * 1000;
  for (;;) {
    const jobs = await listJobs();
    const mine = ids.map((id) => jobs.find((j) => j.id === id)).filter(Boolean);
    const failed = mine.find((j) => j.status === 'failed' || j.status === 'interrupted');
    if (failed) throw new Error(`${failed.label} import failed: ${JSON.stringify(failed.error ?? failed.status)}`);
    if (mine.length === ids.length && mine.every((j) => j.status === 'done')) return;
    if (Date.now() > deadline) throw new Error('imports did not finish within 15min');
    await sleep(5000);
    process.stdout.write(`\r${mine.map((j) => `${j.label}:${j.status} ${j.progress?.done ?? 0}/${j.progress?.total ?? '?'}`).join(' | ').slice(0, 140)}`);
  }
}

const installed = new Set((await listResources()).map((r) => r.name));
const doneIds = [];
for (const file of files) {
  const name = path.basename(file);
  if (installed.has(name)) { console.log(`skip ${name} - already installed`); continue; }
  const base = `seed-${Date.now().toString(36)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const jobId = `${base}-${attempt}`;
    try {
      await uploadFile(file, jobId);
      doneIds.push(jobId);
      break;
    } catch (e) {
      const jobs = await listJobs().catch(() => []);
      const job = jobs.find((j) => j.id === jobId);
      if (job && job.status !== 'interrupted' && job.status !== 'failed') {
        doneIds.push(jobId);
        break;
      }
      if (attempt === 2) throw e;
      console.log(`\n${name}: ${e.message} - retrying`);
      await sleep(2000);
    }
  }
}
if (doneIds.length) {
  await waitJobs(doneIds);
  process.stdout.write('\n');
}
for (const r of await listResources()) {
  console.log(`installed: ${r.name} id=${r.id} enabled=${r.enabled} finished=${r.installationFinished}`);
}
process.exit(0);
