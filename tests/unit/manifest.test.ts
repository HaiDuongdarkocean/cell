import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve(process.cwd(), 'public', 'manifest.json');

function getConnectSrc(): string {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
    content_security_policy?: { extension_pages?: string };
  };
  const csp = manifest.content_security_policy?.extension_pages ?? '';
  const match = csp.match(/connect-src\s+([^;]+)/);
  return match?.[1]?.trim() ?? '';
}

describe('public/manifest.json', () => {
  it('allows http and https in connect-src for AnkiConnect and arbitrary hosts', () => {
    const connectSrc = getConnectSrc();
    expect(connectSrc).toContain('http:');
    expect(connectSrc).toContain('https:');
  });
});
