const fs = require('fs');
const entries = JSON.parse(fs.readFileSync('_srt_entries.json', 'utf8'));
const allText = entries.map(e => e.text).join(' ');
const allTextLower = allText.toLowerCase();

// Read the test file and extract all sentence literals
const testFile = fs.readFileSync('src/features/dictionary/logic/phraseMatcher.srtStress.test.ts', 'utf8');
const sentences = [];
// Match req('...' or req("..."
const re = /req\(\s*'([^']+)'\s*,/g;
let m;
while ((m = re.exec(testFile)) !== null) {
  sentences.push(m[1]);
}
const re2 = /req\(\s*"([^"]+)"\s*,/g;
while ((m = re2.exec(testFile)) !== null) {
  sentences.push(m[1]);
}

console.log('Total test sentences:', sentences.length);
console.log('');

const missing = [];
const found = [];
for (const s of sentences) {
  const sLower = s.toLowerCase();
  if (allTextLower.includes(sLower)) {
    found.push({ sentence: s, status: 'exact' });
  } else {
    const words = sLower.split(/\s+/);
    const probe6 = words.slice(0, Math.min(6, words.length)).join(' ');
    const probe4 = words.slice(0, Math.min(4, words.length)).join(' ');
    if (allTextLower.includes(probe6)) {
      found.push({ sentence: s, status: 'partial-6', probe: probe6 });
    } else if (allTextLower.includes(probe4)) {
      found.push({ sentence: s, status: 'partial-4', probe: probe4 });
    } else {
      missing.push({ sentence: s, probe: probe4 });
    }
  }
}

console.log('=== FOUND in SRT (' + found.length + ') ===');
const partials = found.filter(f => f.status !== 'exact');
for (const f of partials) {
  console.log('[' + f.status + '] "' + f.sentence + '" (probe: "' + f.probe + '")');
}
const exacts = found.filter(f => f.status === 'exact');
console.log('  (' + exacts.length + ' exact matches, ' + partials.length + ' partial)');
console.log('');
console.log('=== NOT FOUND in SRT (' + missing.length + ') ===');
for (const m of missing) {
  console.log('"' + m.sentence + '"');
  console.log('  probe: "' + m.probe + '"');
  const firstWord = m.sentence.toLowerCase().split(/\s+/)[0];
  const matches = entries.filter(e => e.text.toLowerCase().includes(firstWord));
  if (matches.length > 0 && matches.length < 10) {
    for (const match of matches.slice(0, 3)) {
      console.log('  SRT #' + match.idx + ': ' + match.text);
    }
  }
}
