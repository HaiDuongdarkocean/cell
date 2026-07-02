import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const THEME_CSS_PATH = resolve(__dirname, '../../../../../src/entrypoints/popup/styles/theme.css');
const THEME_TOKENS_TS_PATH = resolve(__dirname, '../../../../../src/shared/lib/themeTokens.ts');

function extractTokenValues(cssContent: string, tokenNames: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of tokenNames) {
    // Match `--name: value;` (value up to `;` or end of line)
    const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+)`);
    const match = cssContent.match(re);
    if (match) result[name] = match[1].trim();
  }
  return result;
}

const NAV_CLUSTER_TOKEN_NAMES = [
  '--nav-cluster-size-sm',
  '--nav-cluster-size-md',
  '--nav-cluster-size-lg',
  '--nav-cluster-bg-opacity-default',
  '--nav-cluster-btn-opacity-default',
  '--nav-cluster-collapse-size',
  '--nav-cluster-edge-threshold',
  '--nav-cluster-z-index',
  '--nav-cluster-repeat-hold-ms',
  '--nav-cluster-no-sub-window-ms',
];

describe('Nav cluster tokens — theme.css + themeTokens.ts mirror sync (ADR-018, design-system inventory)', () => {
  const themeCss = readFileSync(THEME_CSS_PATH, 'utf8');
  const themeTokensTs = readFileSync(THEME_TOKENS_TS_PATH, 'utf8');

  it('theme.css :root contains all 10 nav-cluster tokens', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    for (const name of NAV_CLUSTER_TOKEN_NAMES) {
      expect(rootBlock).toContain(name);
    }
  });

  it('themeTokens.ts LIGHT_TOKENS contains all 10 nav-cluster tokens', () => {
    const lightBlock = themeTokensTs.split('LIGHT_TOKENS = `')[1]?.split('`')[0] ?? '';
    for (const name of NAV_CLUSTER_TOKEN_NAMES) {
      expect(lightBlock).toContain(name);
    }
  });

  it('token values match between theme.css :root and themeTokens.ts LIGHT_TOKENS', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    const lightBlock = themeTokensTs.split('LIGHT_TOKENS = `')[1]?.split('`')[0] ?? '';
    const cssValues = extractTokenValues(rootBlock, NAV_CLUSTER_TOKEN_NAMES);
    const tsValues = extractTokenValues(lightBlock, NAV_CLUSTER_TOKEN_NAMES);
    for (const name of NAV_CLUSTER_TOKEN_NAMES) {
      expect(tsValues[name]).toBe(cssValues[name]);
    }
  });

  it('nav-cluster-size-sm is 40px', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    const values = extractTokenValues(rootBlock, ['--nav-cluster-size-sm']);
    expect(values['--nav-cluster-size-sm']).toBe('40px');
  });

  it('nav-cluster-size-md is 48px', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    const values = extractTokenValues(rootBlock, ['--nav-cluster-size-md']);
    expect(values['--nav-cluster-size-md']).toBe('48px');
  });

  it('nav-cluster-size-lg is 56px', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    const values = extractTokenValues(rootBlock, ['--nav-cluster-size-lg']);
    expect(values['--nav-cluster-size-lg']).toBe('56px');
  });

  it('nav-cluster-z-index is 1000001', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    const values = extractTokenValues(rootBlock, ['--nav-cluster-z-index']);
    expect(values['--nav-cluster-z-index']).toBe('1000001');
  });

  it('nav-cluster-repeat-hold-ms is 500', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    const values = extractTokenValues(rootBlock, ['--nav-cluster-repeat-hold-ms']);
    expect(values['--nav-cluster-repeat-hold-ms']).toBe('500');
  });

  it('nav-cluster-no-sub-window-ms is 3000', () => {
    const rootBlock = themeCss.split(':root')[1]?.split('}')[0] ?? '';
    const values = extractTokenValues(rootBlock, ['--nav-cluster-no-sub-window-ms']);
    expect(values['--nav-cluster-no-sub-window-ms']).toBe('3000');
  });
});
