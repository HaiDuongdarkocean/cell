import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { MESSAGE_REGISTRY } from './registry';

const SRC = join(__dirname, '..', '..');
const BG_DIR = join(SRC, 'entrypoints', 'background');

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')
        ? [join(dir, e.name)]
        : [],
  );

const registeredHandlers = (dir: string) => {
  const names = new Set<string>();
  for (const file of walk(dir)) {
    for (const m of readFileSync(file, 'utf8').matchAll(/\.on\(\s*MESSAGE_TYPES\.(\w+)/g)) {
      names.add(m[1]);
    }
  }
  return names;
};

const INCOMING_TO_BG = new Set(['cs->bg', 'panel->bg', 'offscreen->bg']);
const nameToValue = new Map(Object.entries(MESSAGE_TYPES));

describe('message contract', () => {
  it('every MESSAGE_TYPES member has a registry entry', () => {
    const registered = new Set(Object.keys(MESSAGE_REGISTRY));
    const missing = [...nameToValue.values()].filter((v) => !registered.has(v));
    expect(missing).toEqual([]);
  });

  it('no orphan registry entries (key must be a declared MESSAGE_TYPES value)', () => {
    const declared = new Set(nameToValue.values());
    const orphans = Object.keys(MESSAGE_REGISTRY).filter((k) => !declared.has(k as never));
    expect(orphans).toEqual([]);
  });

  it('every incoming-to-background type has a handler registration', () => {
    const handlers = registeredHandlers(BG_DIR);
    const missing = Object.entries(MESSAGE_REGISTRY)
      .filter(([, e]) => INCOMING_TO_BG.has(e.direction))
      .map(([type]) => type)
      .filter((type) => {
        const name = [...nameToValue.entries()].find(([, v]) => v === type)?.[0];
        return !name || !handlers.has(name);
      });
    expect(missing).toEqual([]);
  });
});
