import fs from 'fs';
import path from 'path';

const bases = ['.agents/skills'];

const skills = [];
const invalid = [];
for (const base of bases) {
  if (!fs.existsSync(base)) continue;
  const dirs = fs.readdirSync(base, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  for (const dir of dirs) {
    const fp = path.join(base, dir, 'SKILL.md');
    if (!fs.existsSync(fp)) continue;
    const text = fs.readFileSync(fp, 'utf8');
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!m) { invalid.push(`${fp}: no frontmatter block`); continue; }
    const lines = m[1].split(/\r?\n/);
    for (const line of lines) {
      const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (kv && /: /.test(kv[2]) && !/^["'].*["']\s*$/.test(kv[2].trim())) {
        invalid.push(`${fp}: unquoted ': ' in '${kv[1]}' — loader drops this skill`);
      }
    }
    const fields = {};
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nameMatch = line.match(/^name:\s*(.+)$/);
      if (nameMatch) { fields.name = nameMatch[1].trim(); continue; }
      const descMatch = line.match(/^description:\s*(.*)$/);
      if (descMatch) {
        const rest = descMatch[1].trim();
        if (rest && rest !== '>' && rest !== '|') {
          fields.description = /^"(.*)"$/.test(rest) ? rest.slice(1, -1) : rest;
        } else if (rest === '>' || rest === '|') {
          const parts = [];
          i++;
          while (i < lines.length && /^\s+/.test(lines[i])) {
            parts.push(lines[i].trim());
            i++;
          }
          i--; // step back to last consumed line
          fields.description = parts.join(' ');
        }
      }
    }
    if (fields.name) {
      skills.push({ name: fields.name, description: fields.description || '', path: `${base}/${dir}/SKILL.md` });
    } else {
      invalid.push(`${fp}: missing 'name' field`);
    }
  }
}

const index = {
  version: '1.0',
  generated: new Date().toISOString(),
  count: skills.length,
  skills,
};

fs.writeFileSync(path.join('.agents/skills', 'index.json'), JSON.stringify(index, null, 2));
console.log(`Wrote ${skills.length} skills to .agents/skills/index.json`);

if (invalid.length) {
  console.error('INVALID frontmatter — skill exists on disk and in index but the loader will drop it:');
  for (const v of invalid) console.error(`  ${v}`);
  process.exit(1);
}
