#!/usr/bin/env node
// PreToolUse(write|edit) — protects the ADR loop:
//  src/ edit on a file containing `ADR-NNN` comments → verify each ADR exists
//    in docs/adr/ (dangling = deleted memory) and remind: read before touch.
//  docs/adr/*.md write → numeric prefix unique across the dir, filename starts
//    with the number, and the record carries a Status line.
// Warn-only (house style). Throttled: one emit per (session, hit-set).
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { emitContext, readPayload, ROOT } from './hook-pipeline-common.mjs';

const ADR_DIR = join(ROOT, 'docs', 'adr');
const REF_RE = /\bADR-(\d{3})\b/g;

const adrFilesOnDisk = () => {
  try {
    return readdirSync(ADR_DIR).filter((f) => /^\d{3}-.+\.md$/.test(f));
  } catch {
    return [];
  }
};

const oncePerSession = (payload, tag) => {
  const key = createHash('sha1')
    .update(`${payload?.session_id}:${tag}`)
    .digest('hex')
    .slice(0, 16);
  const marker = join(ROOT, 'tmp', `adr-${key}.done`);
  if (existsSync(marker)) return false;
  try {
    writeFileSync(marker, String(Date.now()));
  } catch {
    /* tmp dir missing → emit anyway */
  }
  return true;
};

readPayload((payload) => {
  const fp = String(payload?.tool_input?.file_path || '').replace(/\\/g, '/');
  if (!fp) process.exit(0);

  const onDiskFiles = adrFilesOnDisk();
  const onDisk = new Set(onDiskFiles.map((f) => f.slice(0, 3)));

  const adrFile = fp.match(/docs\/adr\/([^/]+\.md)$/);
  if (adrFile) {
    const name = adrFile[1];
    const num = name.match(/^(\d{3})-/);
    if (!num) {
      emitContext('PreToolUse', `ADR file '${name}' lacks a NNN- numeric prefix — numbering is the lookup key (see AGENTS.md).`);
    }
    const clash = onDiskFiles.filter((f) => f.slice(0, 3) === num[1] && f !== name);
    if (clash.length) {
      emitContext('PreToolUse', `ADR-${num[1]} already taken by ${clash.join(', ')} — numbering is the lookup key, pick a unique number.`);
    }
    const body =
      String(payload?.tool_input?.content || '') ||
      (existsSync(fp) ? readFileSync(fp, 'utf8') : '');
    if (body && !/(## Status|\*\*Status:\*\*)/.test(body)) {
      emitContext('PreToolUse', `ADR '${name}' has no Status (## Status header or **Status:** line) — status is required.`);
    }
    process.exit(0);
  }

  if (!/(^|\/)src\//.test(fp) || !/\.(ts|tsx|js|jsx|mjs)$/.test(fp)) process.exit(0);
  let text;
  try {
    text = readFileSync(fp, 'utf8');
  } catch {
    process.exit(0);
  }
  const refs = [...new Set([...text.matchAll(REF_RE)].map((m) => m[1]))];
  if (!refs.length) process.exit(0);

  const dangling = refs.filter((n) => !onDisk.has(n));
  const lines = [];
  if (dangling.length) {
    lines.push(
      `DANGLING ADR REFS in ${fp}: ${dangling.map((n) => 'ADR-' + n).join(', ')} — those records are absent from docs/adr/ (001–078 were deleted in 5a2c9213). Treat the comment as broken; if the constraint still matters, recover the ADR from git history or write a new one.`,
    );
  }
  const live = refs.filter((n) => onDisk.has(n));
  if (live.length) {
    lines.push(
      `ADR-CONSTRAINED EDIT: ${fp} references ${live.map((n) => 'ADR-' + n).join(', ')} — read those ADRs before changing this file. Changing the decision = new ADR superseding the old, never editing/deleting the old record.`,
    );
  }
  if (lines.length && oncePerSession(payload, fp + refs.join(','))) {
    emitContext('PreToolUse', lines.join('\n'));
  }
  process.exit(0);
});
