// Probe Cambridge multiword terms vs expected phrases for algorithm design.
const fs = require('fs');
const path = require('path');

const termsPath = path.join(__dirname, 'multiword-terms.txt');
const termsList = fs
  .readFileSync(termsPath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean);
const terms = new Set(termsList.map((t) => t.toLowerCase()));

const probes = [
  'under your nose',
  '(from) under your nose',
  'right under your nose',
  'be under your nose',
  "under one's nose",
  'give up',
  'look after',
  'take off',
  'break down',
  'put up with',
  'carry out',
  'carry out something',
  'carry sth out',
  'run out of',
  'run out of something',
  'a blessing in disguise',
  'a bird in the hand (is worth two in the bush)',
  'a chip on your shoulder',
  'cash flow',
  'piece of cake',
  'break the ice',
  'hit the nail on the head',
  'kick the bucket',
  'spill the beans',
  'let the cat out of the bag',
  'cost an arm and a leg',
  'an arm and a leg',
  'once in a blue moon',
  'in the nick of time',
  '(just) in the nick of time',
  'on the same page',
  'get the ball rolling',
  'get/start the ball rolling',
  'pull yourself together',
  'come up with',
  'come up with something',
  'fiddle around',
  'pipe down',
  'amount to something',
  'amp sb up',
];

function fuzzy(p) {
  const pl = p.toLowerCase();
  const out = [];
  for (const t of termsList) {
    const tl = t.toLowerCase();
    if (tl.includes(pl) || pl.includes(tl)) {
      out.push(t);
      if (out.length >= 5) break;
    }
  }
  return out;
}

for (const p of probes) {
  const hit = terms.has(p.toLowerCase());
  const f = hit ? [] : fuzzy(p);
  console.log(
    `${hit ? 'HIT ' : 'MISS'} | ${p}${f.length ? ' | ~ ' + f.join(' || ') : ''}`,
  );
}
