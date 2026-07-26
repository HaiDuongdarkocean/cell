import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const THEME_CSS_PATH = resolve(__dirname, '../../../../../src/shared/styles/tokens.css');
const TOKENS_JSON_PATH = resolve(__dirname, '../../../../../src/shared/styles/tokens.json');

function extractTokenValues(cssContent: string, tokenNames: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of tokenNames) {
    const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+)`);
    const match = cssContent.match(re);
    if (match) result[name] = match[1].trim();
  }
  return result;
}

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const NAV_CLUSTER_TOKEN_NAMES = [
  '--nav-cluster-size-sm',
  '--nav-cluster-size-md',
  '--nav-cluster-size-lg',
  '--nav-cluster-icon-size-ratio',
  '--nav-cluster-btn-size',
  '--nav-cluster-bg-opacity',
  '--nav-cluster-btn-opacity',
  '--nav-cluster-collapse-size',
  '--nav-cluster-edge-threshold',
  '--nav-cluster-z-index',
  '--nav-cluster-repeat-hold-ms',
  '--nav-cluster-no-sub-window-ms',
];

const tokensJson = JSON.parse(readFileSync(TOKENS_JSON_PATH, 'utf8'));

const expectedNavClusterValues: Record<string, string> = {};
for (const [key, value] of Object.entries(tokensJson.static.navCluster)) {
  expectedNavClusterValues[`--nav-cluster-${kebab(key)}`] = String(value);
}

describe('Nav cluster tokens — tokens.css + tokens.json mirror sync (ADR-018, design-system inventory)', () => {
  const themeCss = readFileSync(THEME_CSS_PATH, 'utf8');

  it('tokens.css :root contains all 12 nav-cluster tokens', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    for (const name of NAV_CLUSTER_TOKEN_NAMES) {
      expect(rootBlock).toContain(name);
    }
  });

  it('tokens.json static.navCluster contains all 12 nav-cluster tokens', () => {
    for (const name of NAV_CLUSTER_TOKEN_NAMES) {
      expect(expectedNavClusterValues[name]).toBeDefined();
    }
  });

  it('token values match between tokens.css :root and tokens.json', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    const cssValues = extractTokenValues(rootBlock, NAV_CLUSTER_TOKEN_NAMES);
    for (const name of NAV_CLUSTER_TOKEN_NAMES) {
      expect(cssValues[name]).toBe(expectedNavClusterValues[name]);
    }
  });

  it('nav-cluster-size-sm is 32px (synced with panel-toggle)', () => {
    expect(expectedNavClusterValues['--nav-cluster-size-sm']).toBe('32px');
  });

  it('nav-cluster-size-md is 32px (synced with panel-toggle)', () => {
    expect(expectedNavClusterValues['--nav-cluster-size-md']).toBe('32px');
  });

  it('nav-cluster-size-lg is 32px (synced with panel-toggle)', () => {
    expect(expectedNavClusterValues['--nav-cluster-size-lg']).toBe('32px');
  });

  it('nav-cluster-z-index is 1000001', () => {
    expect(expectedNavClusterValues['--nav-cluster-z-index']).toBe('1000001');
  });

  it('nav-cluster-repeat-hold-ms is 500', () => {
    expect(expectedNavClusterValues['--nav-cluster-repeat-hold-ms']).toBe('500');
  });

  it('nav-cluster-no-sub-window-ms is 3000', () => {
    expect(expectedNavClusterValues['--nav-cluster-no-sub-window-ms']).toBe('3000');
  });
});
