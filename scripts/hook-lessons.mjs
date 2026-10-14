#!/usr/bin/env node
// PreToolUse(edit/write) — surface accumulated lessons that match the file
// being edited. Without this hook, learning-and-apply is opt-in and gets
// skipped; with it, matching principles arrive as context before the edit.
//
// Throttle: emit once per (session, matched-id-set). Editing 12 files in
// the same domain re-uses the same hit set → one reminder, not twelve.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { emitContext, readPayload, ROOT } from './hook-pipeline-common.mjs';

const INDEX = join(ROOT, '.agents', 'skills', 'learning-and-apply', 'index.json');
const SKIP_DIRS = /(^|\/)(test|tests|e2e|dist|node_modules|\.agents|\.devin|docs|tasks|scripts|public|data|mockup-[^/]*)\//;
const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const MAX_HITS = 4;

const STOPWORDS = new Set([
  'src', 'test', 'spec', 'index', 'lib', 'shared', 'features', 'entrypoints',
  'logic', 'service', 'types', 'utils', 'hooks',
]);
const pathTokens = (fp) => new Set(
  fp.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
);

readPayload((payload) => {
  const fp = String(payload?.tool_input?.file_path || payload?.tool_input?.notebook_path || '')
    .replace(/\\/g, '/');
  if (!fp || !SOURCE_RE.test(fp) || SKIP_DIRS.test(fp)) process.exit(0);
  if (!existsSync(INDEX)) process.exit(0);

  let principles;
  try {
    principles = JSON.parse(readFileSync(INDEX, 'utf8')).principles ?? [];
  } catch {
    process.exit(0);
  }

  const tokens = pathTokens(fp);
  const hits = principles.filter((p) => p.id && Array.isArray(p.tags)
    && p.tags.some((tag) => tag.split('-').some((t) => tokens.has(t))));
  if (!hits.length) process.exit(0);

  const sid = String(payload?.session_id || 'anon').replace(/[^\w.-]/g, '');
  const stateFile = join(tmpdir(), `tihoka-lessons-${sid}.json`);
  let seen = {};
  try { seen = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { /* fresh */ }
  const hitKey = hits.map((h) => h.id).sort().join('|');
  if (seen[hitKey]) process.exit(0);
  seen[hitKey] = Date.now();
  try { writeFileSync(stateFile, JSON.stringify(seen)); } catch { /* non-fatal */ }

  const lines = hits.slice(0, MAX_HITS)
    .map((h) => `  - ${h.id}: ${h.trigger ?? h.title ?? ''}`);
  emitContext(
    'PreToolUse',
    `LESSONS matched for ${fp.split('/').pop()} — read .agents/skills/learning-and-apply/experience/<id>.json before editing:\n${lines.join('\n')}`,
  );
  process.exit(0);
});
