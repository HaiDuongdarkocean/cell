// Script trích xuất term có >=2 từ từ Cambridge JSON.
const fs = require('fs');
const path = require('path');

const cambridgePath = path.join(__dirname, 'resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json');
const outputPath = path.join(__dirname, 'multiword-terms.txt');

const data = JSON.parse(fs.readFileSync(cambridgePath, 'utf8'));
const multiwordTerms = [...new Set(
  data
    .map((entry) => String(entry.term ?? '').trim().normalize('NFC').toLowerCase())
    .filter((term) => term && term.split(/\s+/).length >= 2),
)].sort((a, b) => a.localeCompare(b));

fs.writeFileSync(outputPath, multiwordTerms.join('\n'), 'utf8');
console.log(`Đã trích xuất ${multiwordTerms.length} term có >=2 từ vào ${outputPath}`);
