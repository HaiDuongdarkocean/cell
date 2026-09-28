---
name: security-and-hardening
description: OWASP prevention, input validation, least privilege. Use when handling user input, auth, secrets, or security-sensitive code.
---

# Security and Hardening

Treat every external input as hostile, every secret as sacred, every authorization check as mandatory. Security is a constraint on every line touching user data, auth, or external systems — not a phase.

## When to Use

- Anything accepting user input; auth/authorization; sensitive data storage/transit
- External API/service integrations; file uploads, webhooks, callbacks; payment or PII data

## Process: Threat Model First

Controls bolted on without a threat model are guesses.

1. **Map trust boundaries** — where does untrusted data cross in? HTTP, forms, uploads, webhooks, third-party APIs, **LLM output**.
2. **Name the assets** — credentials, PII, payment data, admin actions.
3. **STRIDE per boundary:**

| Threat | Ask | Mitigation |
|---|---|---|
| Spoofing | Impersonate a user/service? | Auth, signature verification |
| Tampering | Data altered in transit/at rest? | Integrity checks, parameterized queries, HTTPS |
| Repudiation | Action denied later? | Audit logging |
| Information disclosure | Data leaks? | Encryption, field allowlists, generic errors |
| Denial of service | Overwhelmed? | Rate limits, size caps, timeouts |
| Elevation of privilege | Rights they shouldn't have? | Authorization checks, least privilege |

4. **Write abuse cases next to use cases** — "how would I misuse this?" is the first test.

Can't name the trust boundaries → not ready to secure it (OWASP A04: most breaches begin in design).

## Three-tier boundary

**Always do:** validate external input at the boundary; parameterize queries; encode output; HTTPS externally; bcrypt/scrypt/argon2 passwords; security headers; httpOnly+secure+sameSite cookies; native audit on the lockfile before release.

**Ask first:** new auth flows; new sensitive-data categories; new external integrations; CORS changes; file-upload handlers; rate-limit changes; elevated permissions.

**Never do:** commit secrets; log sensitive data; trust client-side validation as a boundary; `eval()`/`innerHTML` with user data; auth tokens in client-accessible storage; expose stack traces.

## Key rules worth remembering

- **SSRF:** server-side fetch of a user-influenced URL needs scheme+host allowlist, all resolved IPs checked private/reserved, redirects forbidden — plus a TOCTOU gap (pin the IP or a filtering agent for high-risk surfaces).
- **Dependency audits** match *known* advisories only — triage by reachability, never `npm audit fix --force`, review install scripts and lockfile diffs.
- **LLM output is untrusted input** — never to eval/SQL/shell/innerHTML; enforce permissions in code, not prompts; keep secrets and cross-tenant data out of context; cap consumption.
- **Skills are injection vectors** — read a skill's source before installing; a SKILL.md description is a prompt hiding in metadata.
- **Permission scope creep** — a "just once" permission never removes itself; re-audit grants ~30 days.
- **Unattended runs are attack surface** — no verbose logging in loops (secrets scatter); every irreversible action keeps a human gate.

→ OWASP patterns with code (SSRF allowlist, validation, rate limiting, secrets, LLM hardening): `references/patterns.md`
→ Dependency triage tree + supply-chain hygiene: `references/supply-chain.md`
→ Review checklist + verification: `references/security-checklist.md`

## Red flags

- User input straight into queries, shell commands, or HTML rendering
- Secrets in source or history; endpoints without auth checks; wildcard CORS
- No rate limiting on auth endpoints; stack traces exposed
- Server fetches user-supplied URLs without allowlist
- LLM output into a query, the DOM, a shell, or `eval`; secrets/PII in the prompt

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
