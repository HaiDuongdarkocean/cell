/**
 * Generate a benchmark HTML page with ~1,000,000 English words.
 *
 * Output: tasks/benchmark-1m-words.html
 *
 * The page mimics a real article structure (headings + paragraphs) so the
 * tokenize controller exercises its full scan → block → bind pipeline.
 * Words are drawn from a weighted pool of common English words so the
 * tokenizer hits realistic token boundaries, not random gibberish.
 */
const fs = require('fs');
const path = require('path');

// --- Word pool (weighted by frequency tier) ---
// Tier 1: top-100 function words (the, of, and, …) — appear ~50% of the time.
const TIER1 = [
  'the', 'of', 'and', 'to', 'a', 'in', 'is', 'that', 'it', 'for',
  'was', 'on', 'are', 'as', 'with', 'his', 'they', 'at', 'be', 'this',
  'from', 'I', 'have', 'or', 'by', 'one', 'had', 'not', 'but', 'what',
  'all', 'were', 'we', 'when', 'your', 'can', 'said', 'there', 'use', 'an',
  'each', 'which', 'she', 'do', 'how', 'their', 'if', 'will', 'up', 'other',
  'about', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would',
  'make', 'like', 'him', 'into', 'time', 'has', 'look', 'two', 'more', 'write',
  'go', 'see', 'number', 'no', 'way', 'could', 'people', 'my', 'than', 'first',
  'water', 'been', 'call', 'who', 'oil', 'its', 'now', 'find', 'long', 'down',
];

// Tier 2: common content words (nouns/verbs/adjectives) — ~35%.
const TIER2 = [
  'world', 'life', 'hand', 'part', 'place', 'case', 'week', 'company',
  'system', 'program', 'question', 'government', 'number', 'night',
  'point', 'fact', 'home', 'room', 'business', 'issue', 'side', 'kind',
  'head', 'house', 'service', 'friend', 'father', 'power', 'hour', 'game',
  'line', 'end', 'member', 'law', 'car', 'city', 'community', 'name',
  'president', 'team', 'minute', 'idea', 'body', 'information', 'back',
  'parent', 'face', 'others', 'level', 'office', 'door', 'health', 'person',
  'art', 'war', 'history', 'party', 'result', 'change', 'morning', 'reason',
  'research', 'girl', 'guy', 'moment', 'air', 'teacher', 'force', 'education',
  'foot', 'boy', 'age', 'policy', 'music', 'market', 'sense', 'nation',
  'plan', 'college', 'interest', 'death', 'experience', 'effect', 'use',
  'class', 'control', 'care', 'field', 'development', 'role', 'effort',
  'rate', 'heart', 'drug', 'show', 'leader', 'light', 'voice', 'wife',
  'police', 'mind', 'price', 'report', 'decision', 'son', 'hope', 'view',
  'relationship', 'town', 'road', 'arm', 'source', 'technology', 'answer',
  'amount', 'type', 'cost', 'industry', 'figure', 'image', 'section',
  'everyone', 'peace', 'project', 'space', 'rule', 'base', 'activity',
  'study', 'event', 'kind', 'problem', 'solution', 'language', 'memory',
  'science', 'process', 'machine', 'design', 'feature', 'performance',
  'algorithm', 'data', 'structure', 'function', 'variable', 'constant',
  'network', 'server', 'client', 'browser', 'extension', 'token', 'parse',
  'render', 'viewport', 'scroll', 'observe', 'schedule', 'priority', 'cache',
  'block', 'element', 'node', 'mutation', 'batch', 'flush', 'idle',
];

// Tier 3: less common / longer words — ~15%.
const TIER3 = [
  'extraordinary', 'comprehensive', 'fundamental', 'significant', 'available',
  'appropriate', 'consistent', 'contribution', 'establishment', 'implementation',
  'infrastructure', 'investigation', 'modification', 'phenomenon', 'qualification',
  'representation', 'sophisticated', 'transformation', 'understanding', 'utilization',
  'accomplish', 'acknowledge', 'acquisition', 'adaptation', 'administrative',
  'advantageous', 'ambiguity', 'architectural', 'assessment', 'asymptotic',
  'authentication', 'authorization', 'benchmark', 'beneficial', 'cancellation',
  'categorical', 'characteristic', 'circumstance', 'collaboration', 'compilation',
  'complexity', 'composition', 'concurrent', 'configuration', 'consequence',
  'constellation', 'contemporary', 'contingency', 'convergence', 'correlation',
  'credibility', 'cryptographic', 'customization', 'decomposition', 'delegation',
  'demonstration', 'derivative', 'deterministic', 'developmental', 'diagnostic',
  'differential', 'dimensional', 'discovery', 'disposition', 'documentation',
  'ecosystem', 'efficiency', 'elaborate', 'eligibility', 'elimination',
  'encapsulation', 'enumeration', 'equilibrium', 'essential', 'evaluation',
  'exceptional', 'experimentation', 'explanatory', 'exploration', 'extensibility',
  'facet', 'familiarity', 'feasibility', 'fluctuation', 'formidable',
  'generalization', 'generation', 'granularity', 'hierarchical', 'homogeneous',
  'hypothesis', 'illustration', 'immutability', 'imperative', 'implementation',
  'inconsistency', 'independence', 'indeterminate', 'indicator', 'inevitable',
  'influence', 'infrequent', 'inheritance', 'innovation', 'integration',
  'intelligence', 'interoperability', 'interpretation', 'intuitive', 'invariant',
  'investigation', 'isolation', 'jurisdiction', 'justification', 'latency',
  'legitimate', 'likelihood', 'localization', 'maintenance', 'manipulation',
  'metamorphosis', 'methodology', 'monolithic', 'negotiation', 'normalization',
  'notwithstanding', 'obfuscation', 'obligation', 'occurrence', 'optimization',
  'orchestration', 'orthogonal', 'parameterization', 'participation', 'permutation',
  'persistence', 'phenomenal', 'polymorphism', 'portability', 'pragmatic',
  'preliminary', 'prerequisite', 'prioritization', 'probability', 'procedural',
  'productivity', 'proficiency', 'proliferation', 'propagation', 'proposition',
  'proximity', 'qualification', 'quantitative', 'quintessential', 'randomization',
  'reconciliation', 'redundancy', 'refactoring', 'regression', 'reliability',
  'reminiscence', 'representation', 'reproducibility', 'resilience', 'resolution',
  'retrospective', 'revolutionary', 'satisfaction', 'scalability', 'scheduling',
  'simultaneous', 'sophistication', 'specification', 'standardization', 'subordinate',
  'substantive', 'sufficient', 'supplementary', 'synchronization', 'synergy',
  'synthesis', 'systematic', 'tangential', 'telemetry', 'threshold',
  'tolerance', 'transaction', 'transparency', 'ubiquitous', 'uncertainty',
  'underlying', 'unprecedented', 'validation', 'variability', 'verification',
  'visualization', 'vulnerability', 'widespread', 'workflow',
];

// Sentence templates — produce realistic-looking prose.
const SENTENCE_TEMPLATES = [
  '{cap} {w} {w} {w} {w} {w} {w} {w} {w}.',
  '{cap} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w}.',
  '{cap} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w}.',
  '{cap} {w} {w} {w} {w}, {w} {w} {w} {w} {w} {w}.',
  '{cap} {w} {w} {w} {w} {w} {w}; {w} {w} {w} {w} {w}.',
  '{cap} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w}.',
  '{cap} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w}.',
  '{cap} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w}.',
  '{cap} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w}.',
  '{cap} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w} {w}.',
];

const HEADING_TEMPLATES = [
  '{cap} {w} {w}',
  '{cap} {w} {w} {w} {w}',
  '{cap} {w} {w} {w} {w} {w} {w}',
  '{cap} {w} {w} {w} {w} {w} {w} {w} {w}',
];

function pickWord() {
  const r = Math.random();
  if (r < 0.50) return TIER1[Math.floor(Math.random() * TIER1.length)];
  if (r < 0.85) return TIER2[Math.floor(Math.random() * TIER2.length)];
  return TIER3[Math.floor(Math.random() * TIER3.length)];
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateSentence() {
  const tpl = SENTENCE_TEMPLATES[Math.floor(Math.random() * SENTENCE_TEMPLATES.length)];
  return tpl
    .replace(/{cap}/g, () => capitalize(pickWord()))
    .replace(/{w}/g, () => pickWord());
}

function generateHeading() {
  const tpl = HEADING_TEMPLATES[Math.floor(Math.random() * HEADING_TEMPLATES.length)];
  return tpl
    .replace(/{cap}/g, () => capitalize(pickWord()))
    .replace(/{w}/g, () => pickWord());
}

// --- Generate ~1,000,000 words ---
const TARGET_WORDS = 1_000_000;
let wordCount = 0;
const paragraphs = [];
let sectionNum = 0;

while (wordCount < TARGET_WORDS) {
  // Every ~15 paragraphs, insert a heading
  if (paragraphs.length > 0 && paragraphs.length % 15 === 0) {
    sectionNum++;
    const heading = generateHeading();
    wordCount += heading.split(/\s+/).length;
    paragraphs.push(`<h2>${heading}</h2>`);
  }

  // Each paragraph: 5-12 sentences
  const sentenceCount = 5 + Math.floor(Math.random() * 8);
  const sentences = [];
  for (let i = 0; i < sentenceCount; i++) {
    const s = generateSentence();
    sentences.push(s);
    wordCount += s.split(/\s+/).length;
  }
  paragraphs.push(`<p>${sentences.join(' ')}</p>`);
}

const body = paragraphs.join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Benchmark: ${wordCount.toLocaleString()} English Words</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #222; }
  h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 2em; }
  p { margin: 0.8em 0; text-align: justify; }
</style>
</head>
<body>
<h1>Benchmark Page — ${wordCount.toLocaleString()} English Words</h1>
<p id="meta">Word count: ${wordCount.toLocaleString()} | Paragraphs: ${paragraphs.length} | Sections: ${sectionNum}</p>
${body}
</body>
</html>
`;

const outPath = path.join(__dirname, 'benchmark-1m-words.html');
fs.writeFileSync(outPath, html);
console.log(`Generated: ${outPath}`);
console.log(`Words: ${wordCount.toLocaleString()}`);
console.log(`Paragraphs: ${paragraphs.length}`);
console.log(`File size: ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB`);
