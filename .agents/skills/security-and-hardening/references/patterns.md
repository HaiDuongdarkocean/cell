# Security — OWASP prevention patterns with code

Reference for `security-and-hardening`. Read the pattern matching the surface you're building.

## Injection (SQL, NoSQL, OS command)

```typescript
// BAD
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// GOOD: parameterized
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
// or ORM
const user = await prisma.user.findUnique({ where: { id: userId } });
```

## Broken authentication

```typescript
import { hash, compare } from 'bcrypt';
const SALT_ROUNDS = 12;
const hashedPassword = await hash(plaintext, SALT_ROUNDS);
const isValid = await compare(plaintext, hashedPassword);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 },
}));
```

## XSS

```typescript
// BAD
element.innerHTML = userInput;

// GOOD: framework auto-escaping (React default)
return <div>{userInput}</div>;

// If HTML rendering is unavoidable, sanitize first
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

## Broken access control

```typescript
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const task = await taskService.findById(req.params.id);
  if (task.ownerId !== req.user.id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } });
  }
  const updated = await taskService.update(req.params.id, req.body);
  return res.json(updated);
});
```

## Security misconfiguration

```typescript
import helmet from 'helmet';
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
}));
```

## Sensitive data exposure

```typescript
function sanitizeUser(user: UserRecord): PublicUser {
  const { passwordHash, resetToken, ...publicFields } = user;
  return publicFields;
}

const API_KEY = process.env.STRIPE_API_KEY;
if (!API_KEY) throw new Error('STRIPE_API_KEY not configured');
```

## SSRF

Any time the server fetches a URL the user influenced — webhooks, "import from URL", image proxies, link previews — an attacker can aim it at internal services (cloud metadata, `localhost`, private IPs).

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

`range() !== 'unicast'` covers loopback, link-local `169.254.169.254` (cloud metadata — the #1 SSRF target), private, and unique-local ranges on IPv4 and IPv6.

**TOCTOU caveat:** `fetch` resolves DNS again after the check — a short-TTL record can rebind to an internal IP between validation and connection. For high-risk surfaces, resolve once and connect to the pinned IP, or put a filtering agent in front (`request-filtering-agent` / `ssrf-req-filter`).

## Input validation at boundaries

```typescript
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().datetime().optional(),
});

app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.flatten() },
    });
  }
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

## File upload safety

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

function validateUpload(file: UploadedFile) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) throw new ValidationError('File type not allowed');
  if (file.size > MAX_SIZE) throw new ValidationError('File too large (max 5MB)');
  // Don't trust the extension — check magic bytes if critical.
}
```

## Rate limiting

```typescript
import rateLimit from 'express-rate-limit';

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
```

## Secrets management

```
.env.example  → committed (placeholders)
.env          → NOT committed (real secrets)
.env.local    → NOT committed (local overrides)

.gitignore must include: .env, .env.local, .env.*.local, *.pem, *.key
```

Before committing: `git diff --cached | grep -i "password\|secret\|api_key\|token"`.

If a secret is ever committed, **rotate it** — deleting the line or rewriting history is not enough. Assume compromise the moment it reaches a remote.

## Securing AI / LLM features (OWASP LLM Top 10, 2025)

- **LLM05 output handling:** model output is untrusted input — never straight into `eval`, SQL, shell, `innerHTML`, or a file path. Validate + encode like raw user input.
- **LLM01 prompt injection:** untrusted text in the context (user message, fetched page, PDF) can carry instructions. The system prompt is not a security boundary — enforce permissions in code.
- **LLM02/LLM07:** keep secrets and other users' data out of prompts — anything in context can be echoed back.
- **LLM06 excessive agency:** scope tools to the minimum; require confirmation for destructive actions; validate every tool argument.
- **LLM10 unbounded consumption:** cap tokens, request rate, and loop depth.
- **LLM08 retrieval isolation (RAG):** the vector store is a trust boundary — partition embeddings per tenant; validate documents before indexing.

```typescript
// BAD: trusting model output as command or markup
const sql = await llm.generate(`Write SQL for: ${userQuestion}`);
await db.query(sql);
container.innerHTML = await llm.reply(userMessage);

// GOOD: model output is data — parse defensively, validate, encode
let intent;
try {
  intent = CommandSchema.parse(JSON.parse(await llm.replyJson(userMessage)));
} catch {
  throw new ValidationError('unexpected model output');
}
await runAllowlistedAction(intent.action, intent.params);
container.textContent = await llm.reply(userMessage);
```
