const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const excludePaths = [
  'src/entrypoints/test',
  'src/shared/icons/icon-gallery.html',
  'src/shared/styles/tokens.css',
  'src/shared/styles/tokens.json',
];

const excludedExtensions = ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx'];

function shouldInclude(relativePath) {
  if (excludedExtensions.some(ext => relativePath.endsWith(ext))) return false;
  for (const ex of excludePaths) {
    if (relativePath.startsWith(ex)) return false;
    if (relativePath === ex) return false;
  }
  return true;
}

function collectSrcFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (ent.isDirectory()) {
      collectSrcFiles(full, files);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name);
      if (['.css', '.ts', '.tsx', '.js', '.jsx'].includes(ext) && shouldInclude(rel)) {
        files.push({ full, relative: rel });
      }
    }
  }
  return files;
}

const files = collectSrcFiles(SRC);
const findings = [];

function add(file, lineNo, category, message, line, fix = null) {
  findings.push({ file, lineNo, category, message, line: line.trim(), fix });
}

function isInsideStringLiteral(line, start, end) {
  // Treat matches inside '...' / "..." / `...` string literals as false positives
  // (e.g. contrast-pair labels like 'White / Primary').
  const stringRe = /(['"`])(?:(?!\1|\\).|\\.)*\1/g;
  for (const m of line.matchAll(stringRe)) {
    if (m.index < start && m.index + m[0].length > end) return true;
  }
  return false;
}

function stripComments(line, ext) {
  if (ext === '.css') {
    // strip /* ... */ (simple, not nested)
    return line.replace(/\/\*[\s\S]*?\*\//g, '');
  }
  // strip // comments for TS/TSX/JS/JSX, and /* ... */
  return line.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/g, '');
}

function computeInsideAtRule(lines) {
  // Track lines inside @media / @container blocks so their pixel breakpoints are ignored.
  const inside = new Array(lines.length).fill(false);
  const stack = [];
  let pendingAtRule = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*@(media|container)\b/i.test(line)) {
      pendingAtRule = true;
    }
    inside[i] = pendingAtRule || (stack.length > 0 && stack[stack.length - 1]);
    for (const ch of line) {
      if (ch === '{') {
        stack.push(pendingAtRule || (stack.length > 0 && stack[stack.length - 1]));
        pendingAtRule = false;
      } else if (ch === '}') {
        stack.pop();
      }
    }
  }
  return inside;
}

// Token map for direct px -> var replacement
const PX_TOKEN_MAP = {
  '0px': '0',
  '1px': 'var(--border-width-hairline)',
  '2px': 'var(--space-0-5)',
  '4px': 'var(--space-1)',
  '6px': 'var(--space-1-5)',
  '8px': 'var(--space-2)',
  '10px': 'var(--space-2-5)',
  '12px': 'var(--space-3)',
  '14px': 'var(--space-3-5)',
  '16px': 'var(--space-4)',
  '18px': 'var(--space-4-5)',
  '20px': 'var(--space-5)',
  '24px': 'var(--space-6)',
  '28px': 'var(--space-7)',
  '32px': 'var(--space-8)',
  '36px': 'var(--space-9)',
  '40px': 'var(--touch-target-desktop)',
  '44px': 'var(--touch-target-mobile)',
  '48px': 'var(--space-12)',
  '64px': 'var(--space-16)',
  '80px': 'var(--space-20)',
  '96px': 'var(--space-24)',
};

function processFile({ full, relative }) {
  const ext = path.extname(full);
  const rawContent = fs.readFileSync(full, 'utf-8');
  // Remove block comments across the whole file to avoid comment-only findings.
  const content = rawContent.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = content.split(/\r?\n/);
  const insideAtRule = ext === '.css' ? computeInsideAtRule(lines) : [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const original = lines[i];
    if (!original.trim()) continue;
    // strip // line comments (TS/JS only)
    const line = ext === '.css' ? original : original.replace(/\/\/.*$/g, '');
    if (!line.trim()) continue;

    // 1. Hardcoded px values (ignore inside url() / data URIs / strings not style)
    const pxMatches = [...line.matchAll(/(?<![A-Za-z0-9_\-])(-?\d+(?:\.\d+)?)px/g)];
    for (const m of pxMatches) {
      const val = m[1];
      // Skip 0px in box-shadow/clip-path offset contexts? We'll flag but suggest 0
      if (line.includes('/* audit-ignore */')) continue;
      // Ignore media/container query breakpoints and matchMedia strings where px is required.
      if (insideAtRule[i]) continue;
      if (/@(?:media|container)\b/i.test(line)) continue;
      if (/matchMedia\s*\(/.test(line)) continue;
      const key = `${parseFloat(val)}px`;
      const fix = PX_TOKEN_MAP[key] || null;
      add(relative, lineNo, 'hardcoded-px', `Hardcoded ${m[0]} value`, original, fix);
    }

    // 2. z-index
    const zCss = line.matchAll(/z-index\s*:\s*([-\d]+)/gi);
    for (const m of zCss) {
      const v = parseInt(m[1], 10);
      let fix;
      if (v >= 0 && v <= 3) {
        // Use calc from --z-dropdown (1000)
        fix = `calc(var(--z-dropdown) - ${1000 - v})`;
      } else if (v === -1) {
        fix = 'calc(var(--z-dropdown) - 1001)';
      } else {
        fix = null; // high values should map to --z-* tokens
      }
      add(relative, lineNo, 'hardcoded-z-index', `Hardcoded z-index ${m[1]}`, original, fix);
    }
    const zTsx = line.matchAll(/zIndex\s*:\s*['"`]?([-\d]+)['"`]?/g);
    for (const m of zTsx) {
      const v = parseInt(m[1], 10);
      let fix;
      if (v >= 1 && v <= 3) fix = `calc(var(--z-dropdown) - ${1000 - v})`;
      else if (v === -1) fix = 'calc(var(--z-dropdown) - 1001)';
      add(relative, lineNo, 'hardcoded-z-index', `Hardcoded zIndex ${m[1]} in style`, original, fix);
    }

    // 3. Hardcoded colors
    // hex colors (valid CSS lengths: 3,4,6,8)
    const hexMatches = line.matchAll(/#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b/g);
    for (const m of hexMatches) {
      // Skip if part of a string that looks like an ID (e.g. #13654 with 5 digits not matched, but #7734 4 digits matched)
      // We'll report all and let manual review
      add(relative, lineNo, 'hardcoded-color', `Hardcoded hex color ${m[0]}`, original, 'var(--color-*)');
    }
    // named colors: word not part of CSS property/identifier (exclude white-space, whiteSpace, black-*, etc.)
    const namedColors = line.matchAll(/(?<![a-zA-Z0-9-])(black|white|red|green|blue|yellow|orange|purple|pink|gray|cyan|magenta|lime|teal|indigo|violet)(?![a-zA-Z0-9-])/gi);
    for (const m of namedColors) {
      const lower = m[1].toLowerCase();
      // Skip if part of 'white-space' already handled by regex, but also skip common CSS values that are not color contexts? e.g. 'pre-wrap' doesn't contain color. white-space excluded.
      if (lower === 'transparent') continue;
      // UI labels (e.g. 'White / Primary') are not color declarations.
      if (isInsideStringLiteral(original, m.index, m.index + m[0].length)) continue;
      // Contextual fixes
      let fix = 'var(--color-*)';
      if (lower === 'black') fix = 'var(--overlay-background)';
      if (lower === 'white') fix = 'var(--overlay-text)';
      add(relative, lineNo, 'hardcoded-color', `Hardcoded named color ${m[0]}`, original, fix);
    }
    // rgba/rgb with raw numbers (not var, not template)
    const rgbMatches = line.matchAll(/\brgba?\s*\(\s*([^)]+)\s*\)/gi);
    for (const m of rgbMatches) {
      const inner = m[1];
      if (/\bvar\s*\(/i.test(inner)) continue;
      if (/\$\{/.test(inner)) continue;
      add(relative, lineNo, 'hardcoded-color', `Hardcoded color ${m[0]}`, original, 'rgba(var(--*-rgb), alpha)');
    }

    // 4. font-family
    const ffMatch = line.match(/font-family\s*:\s*([^;{]+)/i);
    if (ffMatch) {
      const ffValue = ffMatch[1].trim();
      if (ffValue.match(/\bsans-serif\b|\bmonospace\b|\bserif\b/) && !/var\s*\(\s*--font-family\b/.test(ffValue)) {
        add(relative, lineNo, 'hardcoded-font-family', `Hardcoded font-family: ${ffValue}`, original, 'font-family: var(--font-family, sans-serif)');
      }
    }
    const ffTsx = line.match(/fontFamily\s*:\s*['"`]([^'"`]+)['"`]/);
    if (ffTsx) {
      const ffValue = ffTsx[1];
      if (ffValue.match(/\bsans-serif\b|\bmonospace\b/) && !/var\s*\(\s*--font-family\b/.test(ffValue)) {
        add(relative, lineNo, 'hardcoded-font-family', `Hardcoded fontFamily: ${ffValue}`, original, "fontFamily: 'var(--font-family, sans-serif)'");
      }
    }

    // 5. border-radius hardcoded (0, 50%, 100%, var(--space-*))
    const brCss = line.matchAll(/border-radius\s*:\s*(0|50%|100%|var\(\s*--space-[^)]+\))(?![a-zA-Z0-9-])/gi);
    for (const m of brCss) {
      const v = m[1].toLowerCase();
      let fix;
      if (v === '0') fix = 'var(--radius-none)';
      else if (v === '50%' || v === '100%') fix = 'var(--radius-full)';
      else if (v.startsWith('var(--space-')) fix = 'var(--radius-*)';
      add(relative, lineNo, 'hardcoded-border-radius', `Hardcoded border-radius value ${m[1]}`, original, fix);
    }
    const brTsx = line.matchAll(/borderRadius\s*:\s*['"`]?(0|50%|100%|var\(\s*--space-[^)]+\))['"`]?/g);
    for (const m of brTsx) {
      const v = m[1].toLowerCase();
      let fix;
      if (v === '0') fix = 'var(--radius-none)';
      else if (v === '50%' || v === '100%') fix = 'var(--radius-full)';
      else if (v.startsWith('var(--space-')) fix = 'var(--radius-*)';
      add(relative, lineNo, 'hardcoded-border-radius', `Hardcoded borderRadius value ${m[1]}`, original, fix);
    }

    // 6. stroke-width, box-shadow, backdrop-filter, durations, easing
    if (/\bstroke-width\s*:/i.test(line)) {
      const sw = line.match(/stroke-width\s*:\s*([^;{]+)/i);
      if (sw && !sw[1].includes('var(--stroke-width') && !sw[1].includes('var(--space-')) {
        add(relative, lineNo, 'hardcoded-stroke-width', `Hardcoded stroke-width: ${sw[1].trim()}`, original, 'var(--stroke-width-*) or calc(var(--stroke-width-*) * N)');
      }
    }
    if (/\bbox-shadow\s*:/i.test(line)) {
      const bs = line.match(/box-shadow\s*:\s*([^;{]+)/i);
      if (bs) {
        const val = bs[1].trim();
        if (val.toLowerCase() === 'none') {
          add(relative, lineNo, 'hardcoded-box-shadow', `Hardcoded box-shadow: none`, original, 'var(--shadow-sm)');
        } else if (!val.includes('var(--shadow') && !val.includes('var(--card-shadow') && !val.includes('var(--dialog-shadow') && !val.includes('var(--input-focus-ring') && !val.includes('var(--cell-token-freq-border')) {
          // Heuristic: if it contains var() but not a shadow token, it's likely a focus ring, note.
          if (val.includes('var(')) {
            add(relative, lineNo, 'hardcoded-box-shadow', `Box-shadow uses raw lengths with tokenized parts: ${val}`, original, 'use --shadow-* token or tokenize all raw values');
          } else {
            add(relative, lineNo, 'hardcoded-box-shadow', `Hardcoded box-shadow: ${val}`, original, 'var(--shadow-*)');
          }
        }
      }
    }
    if (/\bbackdrop-filter\s*:/i.test(line)) {
      const bf = line.match(/backdrop-filter\s*:\s*([^;{]+)/i);
      if (bf && !bf[1].includes('var(--blur')) {
        add(relative, lineNo, 'hardcoded-backdrop-filter', `Hardcoded backdrop-filter: ${bf[1].trim()}`, original, 'blur(var(--blur-*))');
      }
    }

    // durations: transition/animation with ms/s not using duration/transition token
    const durMatches = line.matchAll(/(transition|animation(?:-duration)?)\s*:\s*([^;{]+)/gi);
    for (const m of durMatches) {
      const prop = m[1].toLowerCase();
      const value = m[2];
      if (/\b\d+(?:\.\d+)?ms\b/.test(value) || /\b\d+(?:\.\d+)?s\b/.test(value)) {
        if (!value.includes('var(--duration') && !value.includes('var(--transition')) {
          // 0.01ms is accessibility reduced-motion hack — not tokenizable
          if (value.includes('0.01ms')) {
            continue;
          } else {
            add(relative, lineNo, 'hardcoded-duration', `Hardcoded duration in ${prop}: ${value.trim()}`, original, 'var(--duration-*)');
          }
        }
      }
    }

    // easing cubic-bezier not using var
    const cbMatches = line.matchAll(/cubic-bezier\s*\(\s*([^)]+)\s*\)/gi);
    for (const m of cbMatches) {
      const val = m[1].trim();
      if (!line.includes('var(--ease')) {
        add(relative, lineNo, 'hardcoded-easing', `Hardcoded cubic-bezier: ${m[0]}`, original, 'var(--ease-*)');
      }
    }

    // Other SSOT: hover with --color-accent
    if (/\bcolor-accent\b/i.test(original) && /:\s*hover/.test(original)) {
      add(relative, lineNo, 'ssot-other', `Use --color-surface-hover for hover instead of --color-accent`, original, 'var(--color-surface-hover)');
    }
  }
}

for (const f of files) processFile(f);

const grouped = {};
for (const f of findings) {
  grouped[f.category] = grouped[f.category] || [];
  grouped[f.category].push(f);
}

for (const cat of Object.keys(grouped).sort()) {
  console.log(`\n=== ${cat} (${grouped[cat].length}) ===`);
  for (const f of grouped[cat]) {
    console.log(`${f.file}:${f.lineNo}: ${f.message} | fix: ${f.fix}`);
  }
}

console.log(`\nTotal files scanned: ${files.length}`);
console.log(`Total findings: ${findings.length}`);
