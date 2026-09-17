import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const JOBS = [
  {
    source: 'data/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json',
    out: 'tests/data-test/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json',
    normalize: (term) => String(term ?? '').trim().normalize('NFC').toLowerCase(),
    sentinels: [
      'take off',
      'kick the bucket',
      'be (right) under your nose',
      'spill the beans',
      'hit the nail on the head',
      'a close/near thing',
      'a (quick/brisk) trot through sth',
      'a nip (here) and a tuck (there)',
      'a/b/c share',
      'look up',
      'get up',
      'break down',
      'carry on',
      'bring up',
      'give up',
      'put off',
      'turn down',
      'run into',
      'come across',
      'look forward to',
    ],
    buckets: [
      { test: (t) => /\.\.\.|(?:^|\s)etc\.?(?:$|\s|[!?.,])/i.test(t), takeAll: true },
      { test: (t) => /[()]/.test(t) },
      { test: (t) => /\//.test(t) },
      { test: (t) => /\b(sb|sth|somebody|someone|something)\b/.test(t) },
      { test: (t) => /['’"]/.test(t) },
      { test: (t) => /\d/.test(t) },
      { test: () => true },
    ],
    isMultiword: (term) => term.split(/\s+/).length >= 2,
    multiwordTarget: 1400,
    singleTarget: 120,
    isSingle: (term) => /^[a-z][a-z'’-]*$/.test(term),
  },
  {
    source: 'data/resource/zh/MoedictSimplified.json',
    out: 'tests/data-test/resource/zh/MoedictSimplified.json',
    normalize: (term) => String(term ?? '').trim().normalize('NFC'),
    sentinels: [
      '我', '喜欢', '你', '他', '在', '学习', '中文', '八面玲珑', '画蛇添足',
      '的', '故事', '守株待兔', '学', '中国', '很', '大', '在学',
    ],
    buckets: [
      { test: (t) => CJK.test(t) && t.length === 4, quota: 220 },
      { test: (t) => CJK.test(t) && t.length >= 2, quota: 1100 },
      { test: (t) => CJK.test(t), quota: 250 },
      { test: () => true, quota: 50 },
    ],
    isMultiword: () => false,
    multiwordTarget: 0,
    singleTarget: 0,
  },
];

const CJK = /^[一-鿿㐀-䶿]+$/;

function normalizeTerm(job, entry) {
  return job.normalize(entry.term);
}

function pickFields(entries) {
  const keep = new Set(['term']);
  for (const e of entries) {
    for (const [key, value] of Object.entries(e)) {
      if (value !== '' && value != null) keep.add(key);
    }
  }
  return (entry) => {
    const slim = {};
    for (const key of keep) slim[key] = entry[key];
    return slim;
  };
}

function strided(pool, count) {
  if (pool.length <= count) return pool;
  const step = pool.length / count;
  const picked = [];
  for (let i = 0; i < count; i++) picked.push(pool[Math.floor(i * step)]);
  return picked;
}

function buildEnglishSubset(entries, job) {
  const byTerm = new Map();
  for (const e of entries) {
    const term = normalizeTerm(job, e);
    if (term && !byTerm.has(term)) byTerm.set(term, e);
  }
  const selected = new Map();
  for (const sentinel of job.sentinels) {
    const e = byTerm.get(sentinel);
    if (e) selected.set(sentinel, e);
  }
  const multiword = [...byTerm.entries()].filter(([t]) => job.isMultiword(t) && !selected.has(t));
  const bucketed = job.buckets.map(() => []);
  for (const pair of multiword) {
    const idx = job.buckets.findIndex((b) => b.test(pair[0]));
    bucketed[idx].push(pair);
  }
  for (let i = 0; i < job.buckets.length; i++) {
    if (!job.buckets[i].takeAll) continue;
    for (const [t, e] of bucketed[i]) selected.set(t, e);
    bucketed[i] = [];
  }
  let multiCount = [...selected.keys()].filter(job.isMultiword).length;
  let progress = true;
  while (multiCount < job.multiwordTarget && progress) {
    progress = false;
    for (const bucket of bucketed) {
      const pair = bucket.shift();
      if (!pair) continue;
      selected.set(pair[0], pair[1]);
      multiCount++;
      progress = true;
      if (multiCount >= job.multiwordTarget) break;
    }
  }
  const singles = entries.filter((e) => {
    const term = normalizeTerm(job, e);
    return job.isSingle(term) && !selected.has(term) && e.pronunciation && e.definition;
  });
  for (const e of strided(singles, job.singleTarget)) selected.set(normalizeTerm(job, e), e);
  return [...selected.values()];
}

function buildChineseSubset(entries, job) {
  const byTerm = new Map();
  for (const e of entries) {
    const term = normalizeTerm(job, e);
    if (term && !byTerm.has(term)) byTerm.set(term, e);
  }
  const selected = new Map();
  for (const sentinel of job.sentinels) {
    const e = byTerm.get(sentinel);
    if (e) selected.set(sentinel, e);
  }
  for (const bucket of job.buckets) {
    const pool = [];
    for (const [t, e] of byTerm) {
      if (!selected.has(t) && bucket.test(t)) pool.push([t, e]);
    }
    for (const [t, e] of strided(pool, bucket.quota)) selected.set(t, e);
  }
  return [...selected.values()];
}

function main() {
  for (const job of JOBS) {
    const sourcePath = resolve(ROOT, job.source);
    const outPath = resolve(ROOT, job.out);
    if (!existsSync(sourcePath)) {
      console.warn(`[fixture] source missing, skipped: ${job.source}`);
      continue;
    }
    const entries = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const subset = job.source.includes('/en/') ? buildEnglishSubset(entries, job) : buildChineseSubset(entries, job);
    const slim = pickFields(entries);
    const slimmed = subset.map(slim);
    mkdirSync(dirname(outPath), { recursive: true });
    const json = JSON.stringify(slimmed);
    writeFileSync(outPath, json);
    const bytes = Buffer.byteLength(json, 'utf8');
    console.log(`[fixture] ${job.out} <- ${slimmed.length}/${entries.length} entries (${(bytes / 1024).toFixed(0)}KB)`);
  }
}

main();
