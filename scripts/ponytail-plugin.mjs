import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function findPluginFile(relPath) {
  const cacheDir = join(
    process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'),
    'devin', 'cli', 'plugins', 'cache',
  );
  if (!existsSync(cacheDir)) return null;
  const candidates = [];
  for (const pluginDir of readdirSync(cacheDir)) {
    if (!pluginDir.includes('ponytail')) continue;
    const pluginPath = join(cacheDir, pluginDir);
    for (const versionDir of readdirSync(pluginPath)) {
      const file = join(pluginPath, versionDir, relPath);
      if (existsSync(file)) candidates.push({ file, versionDir });
    }
  }
  const byVersion = (a, b) => {
    const pa = a.versionDir.split('.').map(Number);
    const pb = b.versionDir.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  };
  return candidates.sort(byVersion).pop()?.file || null;
}
