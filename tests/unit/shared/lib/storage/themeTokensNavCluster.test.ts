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
  '--nav-cluster-button-size',
  '--nav-cluster-button-icon',
  '--nav-cluster-gap',
  '--nav-cluster-radius',
  '--nav-cluster-shadow',
];

const tokensJson = JSON.parse(readFileSync(TOKENS_JSON_PATH, 'utf8'));

const expectedNavClusterValues: Record<string, string> = {};
for (const [key, value] of Object.entries(tokensJson.static.navCluster)) {
  expectedNavClusterValues[`--nav-cluster-${kebab(key)}`] = String(value);
}

describe('Nav cluster tokens — tokens.css + tokens.json mirror sync (ADR-018, design-system inventory)', () => {
  const themeCss = readFileSync(THEME_CSS_PATH, 'utf8');

  it('tokens.css :root contains all nav-cluster tokens', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    for (const name of NAV_CLUSTER_TOKEN_NAMES) {
      expect(rootBlock).toContain(name);
    }
  });

  it('tokens.json static.navCluster contains all nav-cluster tokens', () => {
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

  it('nav-cluster-button-size is 36px', () => {
    expect(expectedNavClusterValues['--nav-cluster-button-size']).toBe('36px');
  });

  it('nav-cluster-button-icon is 20px', () => {
    expect(expectedNavClusterValues['--nav-cluster-button-icon']).toBe('20px');
  });

  it('nav-cluster-gap is 4px', () => {
    expect(expectedNavClusterValues['--nav-cluster-gap']).toBe('4px');
  });

  it('nav-cluster-radius is 9999px', () => {
    expect(expectedNavClusterValues['--nav-cluster-radius']).toBe('9999px');
  });
});
