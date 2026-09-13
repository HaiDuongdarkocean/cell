import { execSync } from 'child_process';

let data = '';
process.stdin.on('data', c => (data += c)).on('end', () => {
  try {
    const payload = JSON.parse(data);
    const fp = String(payload?.tool_input?.file_path || payload?.file_path || '').replace(/\\/g, '/');
    if (/\.agents\/skills\/[^/]+\/SKILL\.md$/i.test(fp)) {
      execSync('node scripts/update-skill-index.mjs', { stdio: 'inherit' });
    }
  } catch {
    // malformed payload — never block the tool call
  }
});
