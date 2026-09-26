export interface DetectedPackage {
  readonly dslName: string;
  readonly kind: 'single' | 'split';
  readonly zipName?: string;
  readonly pattern?: string;
}

export type PackageDetection =
  | { readonly ok: true; readonly pkg: DetectedPackage }
  | { readonly ok: false; readonly reason: 'no-dsl' | 'no-archive' };

function withoutExt(name: string, ext: string): string {
  return name.slice(0, name.length - ext.length);
}

function pickDsl(dslNames: readonly string[], preferredBase?: string): string | undefined {
  if (preferredBase) {
    const hit = dslNames.find((n) => n.toLowerCase() === preferredBase.toLowerCase());
    if (hit) return hit;
  }
  return dslNames[0];
}

function deriveSplitPattern(zipNames: readonly string[]): string | undefined {
  const groups = new Map<string, Set<string>>();
  for (const name of zipNames) {
    const match = /^(.*)([a-z_])\.zip$/i.exec(name);
    if (!match) continue;
    const letters = groups.get(match[1]) ?? new Set<string>();
    letters.add(match[2].toLowerCase());
    groups.set(match[1], letters);
  }
  let best: string | undefined;
  let bestCount = 1;
  for (const [prefix, letters] of groups) {
    if (letters.size > bestCount) {
      best = prefix;
      bestCount = letters.size;
    }
  }
  return best === undefined ? undefined : `${best}{firstLetter}.zip`;
}

export function detectPackage(fileNames: readonly string[]): PackageDetection {
  const dslNames = fileNames.filter((n) => /\.dsl$/i.test(n));
  const zipNames = fileNames.filter((n) => /\.zip$/i.test(n));
  if (dslNames.length === 0) return { ok: false, reason: 'no-dsl' };

  const conventional = zipNames.find((n) => /\.dsl\.files\.zip$/i.test(n));
  if (conventional) {
    const dslName = pickDsl(dslNames, withoutExt(conventional, '.files.zip'))!;
    return { ok: true, pkg: { dslName, kind: 'single', zipName: conventional } };
  }
  if (zipNames.length === 1) {
    return { ok: true, pkg: { dslName: dslNames[0], kind: 'single', zipName: zipNames[0] } };
  }
  const pattern = deriveSplitPattern(zipNames);
  if (!pattern) return { ok: false, reason: 'no-archive' };
  const dslBase = `${pattern.split('{firstLetter}')[0].replace(/[_\-. ]+$/, '')}.dsl`;
  const dslName = pickDsl(dslNames, dslBase) ?? dslNames[0];
  return { ok: true, pkg: { dslName, kind: 'split', pattern } };
}
