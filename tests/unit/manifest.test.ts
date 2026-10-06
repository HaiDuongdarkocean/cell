import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve(process.cwd(), 'public', 'manifest.json');
const SHIPPED_EXTENSION_ID = 'ifceodogdeeaacmdigljgmafnhkbfnia';

function extensionIdOfManifestKey(): string {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { key?: string };
  const der = Buffer.from(manifest.key ?? '', 'base64');
  return Array.from(createHash('sha256').update(der).digest().subarray(0, 16))
    .map((b) => String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 15)))
    .join('');
}

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

  it('pins the shipped extension id so unpacked and CRX builds share the OAuth redirect URI', () => {
    expect(extensionIdOfManifestKey()).toBe(SHIPPED_EXTENSION_ID);
  });
});
