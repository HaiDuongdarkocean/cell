// ldoce.mjs adapter coverage — synthetic LDOCE5++ record exercising the
// secondary markup classes audited 2026-09-22 (REGISTERLAB, merge_sense,
// BREQUIV/AMEQUIV, FIELDXX, ColloExa, EXPL, PhrVbEntry, RELATEDWD, ORTHVAR,
// ThesBox/Exponent, corpus, bussdict tail sections).
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ADAPTER = pathToFileURL(join(__dirname, '../../../scripts/dict-adapters/ldoce.mjs')).href;

const RECORD = `
<div class="dictionary">
<span class="ldoceEntry">
  <span class="frequent Head"><span class="HWD">take</span><span class="HOMNUM">1</span>
    <a class="PronCodes" href="sound://x.mp3"><span class="neutral span"> /</span><span class="PRON">teɪk</span><span class="neutral span">/</span></a>
    <span class="Variant"><span class="neutral span">, </span><span class="ORTHVAR">takin'</span></span>
    <span class="lm5pp_POS"> verb</span></span>
  <span class="newline Sense" id="take__31">
    <span class="SIGNPOST LDOCE_switch_lang switch_siblings">sex<span class="cn_txt"> 性</span></span>
    <span class="GRAM LDOCE_switch_lang switch_siblings"><span class="neutral span"> [</span>transitive<span class="neutral span">]</span></span>
    <span class="REGISTERLAB LDOCE_switch_lang switch_siblings"> literary</span>
    <span class="DEF LDOCE_switch_lang switch_siblings"> if a man takes someone, he has sex with them</span>
    <span class="DEF LDOCE_switch_lang switch_siblings"> <span class="cn_txt"> 〔男性〕发生性行为</span></span>
  </span>
  <span class="newline Sense" id="take__25">
    <span class="REFHWD merge_sense">take somebody out of themselves</span>
    <span class="GEO LDOCE_switch_lang">British English</span>
    <span class="DEF LDOCE_switch_lang switch_siblings"> to make someone forget their problems and feel more confident</span>
    <span class="BREQUIV"><span class="synopp span">SYN</span><span class="geo span"> British English</span><a href="entry://sit"> sit</a></span>
  </span>
  <span class="newline Sense" id="take__9">
    <span class="DEF LDOCE_switch_lang switch_siblings"> to do an examination or test</span>
    <span class="AMEQUIV"><span class="synopp span">SYN</span><span class="geo span"> American English</span><a href="entry://take-in"> take in</a></span>
    <span class="ColloExa"><span class="COLLO">take a picture/photograph/photo</span><span class="EXAMPLE"><span class="english LDOCE_switch_lang switch_children">Would you mind taking a photo?<span class="cn_txt"> 拍照</span></span></span></span>
    <span class="EXPL"><span>In this meaning, </span><span class="EXPR">take</span><span> is not used in the progressive. </span><span class="dont_say">Don’t say: </span><span class="BADEXA"> I’m taking.</span></span>
  </span>
  <span class="newline Sense" id="take__40">
    <span class="REFHWD merge_sense LDOCE5pp_sensefold_other">take somebody/something ↔</span>
    <span class="DEF">phrasal verb section</span>
    <span class="Subsense"><span class="LEXUNIT">be taken in</span><span class="DEF">to be tricked</span></span>
    <span class="Subsense"><span class="LEXUNIT">take somebody ↔ in</span><span class="DEF">to let someone stay in your home</span></span>
  </span>
  <span class="Tail"><span class="ThesBox BoxHide lm5ppBox"><span class="BoxPanel"><span class="Section">
    <span class="Exponent"><span class="display EXP LDOCE_switch_lang">take</span><span class="DEF LDOCE_switch_lang"> to move or go with someone</span><span class="EXAMPLE"><span class="english LDOCE_switch_lang">Don’t forget your keys.</span></span></span>
  </span></span></span></span></span>
  <span class="assetlink corpus"><span class="exaGroup cexa1"><span class="title">take</span>
    <span class="cexa1g1 exa" info="UK" type="CORPUS"><span class="neutral span">• </span>Can you give me an idea how long this is going to take ?</span>
  </span></span>
</span>
</div>
<span class="PhrVbEntry"><span class="Tail"><span class="Crossref"><span class="neutral span"> →</span><a class="crossRef" href="entry://take-in" title="take in"> <span class="REFHWD">take <span class="OBJECT"> something →</span> in</span></a></span></span></span>
<span class="dictentry bussdict"><span class="dictionary_intro span">From Longman Business Dictionary</span>
  <span class="bussdictEntry Entry"><span class="Head"><span class="lm5pp_POS"> noun</span></span>
    <span class="Sense" id="take__41"><span class="sensenum span">1</span><span class="FIELDXX">FINANCE</span><span class="DEF">the amount of money earned by a business</span><span class="EXAMPLE">80% is from merchandise.</span></span>
  </span></span>
`;

function parse(html: string): Record<string, unknown> {
  const script = `
import { ldoce } from ${JSON.stringify(ADAPTER)};
const html = ${JSON.stringify(html)};
console.log(JSON.stringify(ldoce.parse(html)));
`;
  const r = spawnSync('node', ['--input-type=module', '-e', script], { encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`adapter run failed: ${r.stderr}`);
  return JSON.parse(r.stdout.trim().split('\n').pop()!);
}

type Sense = { pos?: string; labels?: string[]; lines: { role: string; text: string; pattern?: string; citation?: string }[]; synonyms?: string[] };

const senseAt = (out: { senses: Sense[] }, pred: (s: Sense) => boolean) => out.senses.find(pred);

describe('ldoce adapter — secondary markup classes', () => {
  const out = parse(RECORD) as {
    senses: Sense[];
    related: { term: string; kind: string }[];
    spawned?: { term: string; senses: Sense[] }[];
    altterm?: string;
  };

  it('captures REGISTERLAB register labels (literary)', () => {
    const s = senseAt(out, (x) => x.lines[0]?.text.includes('has sex with'));
    expect(s?.labels).toContain('literary');
    expect(s?.labels).toContain('transitive');
  });

  it('splits REFHWD merge_sense phrase senses into spawned entries + related link', () => {
    const sp = out.spawned?.find((x) => x.term === 'take somebody out of themselves');
    expect(sp?.senses[0]?.pos).toBe('phrase');
    expect(sp?.senses[0]?.lines[0]?.text).toContain('forget their problems');
    expect(sp?.senses[0]?.labels).toContain('British English');
    expect(out.senses.some((x) => x.lines[0]?.text.includes('forget their problems'))).toBe(false);
    expect(out.related).toContainEqual({ term: 'take somebody out of themselves', kind: 'expression' });
  });

  it('derives phrasal term from ↔ merge_sense heads via LEXUNIT particle', () => {
    const sp = out.spawned?.find((x) => x.term === 'take in');
    expect(sp?.senses[0]?.pos).toBe('phrasal verb');
    expect(out.related).toContainEqual({ term: 'take in', kind: 'expression' });
  });

  it('captures BREQUIV/AMEQUIV synonyms with geo qualifier', () => {
    const br = out.spawned?.find((x) => x.term === 'take somebody out of themselves')?.senses[0];
    expect(br?.synonyms).toContain('sit (British English)');
    const am = senseAt(out, (x) => x.lines[0]?.text.includes('examination or test'));
    expect(am?.synonyms).toContain('take in (American English)');
  });

  it('captures ColloExa collocations as pattern examples', () => {
    const s = senseAt(out, (x) => x.lines.some((l) => l.pattern === '[take a picture/photograph/photo]'));
    expect(s).toBeTruthy();
  });

  it('captures EXPL grammar notes (incl. don’t-say)', () => {
    const s = senseAt(out, (x) => x.lines.some((l) => l.role === 'note' && l.text.includes('not used in the progressive')));
    expect(s).toBeTruthy();
  });

  it('captures PhrVbEntry crossrefs as related phrasal (href key)', () => {
    expect(out.related).toContainEqual({ term: 'take-in', kind: 'phrasal' });
  });

  it('captures ORTHVAR head variants as altterm', () => {
    expect(out.altterm).toBe("takin'");
  });

  it('captures bussdict tail senses with FIELDXX labels', () => {
    const s = senseAt(out, (x) => x.lines[0]?.text.includes('amount of money earned'));
    expect(s?.labels).toContain('FINANCE');
    expect(s?.pos).toBe('noun');
  });

  it('captures ThesBox exponents as thesaurus pseudo-sense', () => {
    const s = senseAt(out, (x) => x.labels?.includes('thesaurus') === true);
    expect(s?.lines.some((l) => l.text === 'take — to move or go with someone')).toBe(true);
  });

  it('captures corpus boxes as corpus pseudo-sense', () => {
    const s = senseAt(out, (x) => x.labels?.includes('corpus') === true);
    expect(s?.lines.some((l) => l.citation === 'corpus' && l.text.startsWith('Can you give me'))).toBe(true);
  });

  it('never emits cn_txt bilingual text', () => {
    const all = out.senses.flatMap((s) => s.lines.map((l) => l.text)).join(' ');
    expect(all).not.toMatch(/[一-鿿]/);
  });
});
