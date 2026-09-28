# Security — OWASP prevention patterns with code

Reference for `security-and-hardening`. Read the pattern matching the surface you're building.

## Quick rules (no code needed)

| Surface | Rule |
|---|---|
| SQL/NoSQL/command | Parameterize everything; ORM `findUnique({ where: { id } })` — never string-concatenate input |
| Passwords | bcrypt/scrypt/argon2, salt rounds ≥12 |
| Sessions | `httpOnly`, `secure`, `sameSite`, `resave:false`, `saveUninitialized:false`, maxAge ≤24h |
| XSS | Framework escaping by default; unavoidable HTML → `DOMPurify.sanitize` first |
| Access control | Check `resource.ownerId === req.user.id` server-side on every mutation — not just route-level auth |
| Headers | `helmet()` + CSP `defaultSrc 'self'`; CORS to explicit origins, credentials only when needed |
| API responses | Strip secrets/PII fields (`const { passwordHash, ...pub } = user`) — never serialize the DB record |
| Env secrets | `.env`/`.env.local`/`*.pem`/`*.key` in `.gitignore`; committed secret = compromised → **rotate** |
| Uploads | Allowlist MIME + size cap; check magic bytes when critical — never trust the extension |
| Rate limits | `express-rate-limit`: `/api/` ~100/15min, `/api/auth/` ~10/15min |
| Validation | Schema-parse at the boundary (zod `safeParse` → 422); never pass `req.body` raw to services |

## SSRF

Any server-side fetch of a URL the user influenced — webhooks, "import from URL", image proxies, link previews — can aim at internal services (cloud metadata, `localhost`, private IPs).

```typescript
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

const ALLOWED_HOSTS = new Set(['hooks.example.com']);

async function assertSafeUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('https only');
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('host not allowed');
  // Resolve ALL records; a single private/reserved address fails the check.
  const addrs = await lookup(url.hostname, { all: true });
  if (addrs.some((a) => ipaddr.parse(a.address).range() !== 'unicast')) {
    throw new Error('private/reserved IP');
  }
  return url;
}

await fetch(await assertSafeUrl(req.body.webhookUrl), { redirect: 'error' });
```

`range() !== 'unicast'` covers loopback, link-local `169.254.169.254` (cloud metadata — the #1 SSRF target), private, and unique-local on IPv4/IPv6.

**TOCTOU caveat:** `fetch` resolves DNS again after the check — a short-TTL record can rebind between validation and connection. High-risk surfaces: resolve once and connect to the pinned IP, or front with a filtering agent (`request-filtering-agent`).

## Securing AI / LLM features (OWASP LLM Top 10, 2025)

- **LLM05 output handling:** model output is untrusted input — never to `eval`, SQL, shell, `innerHTML`, or file paths.
- **LLM01 prompt injection:** untrusted context text can carry instructions; the system prompt is not a security boundary — enforce permissions in code.
- **LLM02/07:** keep secrets and other users' data out of prompts — anything in context can be echoed.
- **LLM06 excessive agency:** minimum-scoped tools; confirmation for destructive actions; validate every tool argument.
- **LLM10 unbounded consumption:** cap tokens, request rate, loop depth.
- **LLM08 retrieval isolation:** the vector store is a trust boundary — partition per tenant; validate docs before indexing.

```typescript
// BAD
const sql = await llm.generate(`Write SQL for: ${userQuestion}`);
await db.query(sql);
container.innerHTML = await llm.reply(userMessage);

// GOOD: model output is data — parse defensively, validate, encode
const intent = CommandSchema.parse(JSON.parse(await llm.replyJson(userMessage)));
await runAllowlistedAction(intent.action, intent.params);
container.textContent = await llm.reply(userMessage);
```
