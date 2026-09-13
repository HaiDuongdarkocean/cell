---
name: security-and-hardening
description: OWASP prevention, input validation, least privilege. Use when handling user input, auth, secrets, or security-sensitive code.
---

# Security and Hardening

## Overview

Treat every external input as hostile, every secret as sacred, every authorization check as mandatory. Security is a constraint on every line touching user data, auth, or external systems — not a phase.

## When to Use

- Anything that accepts user input; auth or authorization; sensitive data storage/transit
- External API/service integrations; file uploads, webhooks, callbacks; payment or PII data

## Process: Threat Model First

Controls bolted on without a threat model are guesses. Before hardening, spend five minutes thinking like an attacker:

1. **Map the trust boundaries** — where does untrusted data cross in? HTTP, forms, uploads, webhooks, third-party APIs, **LLM output**.
2. **Name the assets** — credentials, PII, payment data, admin actions.
3. **Run STRIDE per boundary:**

| Threat | Ask | Mitigation |
|---|---|---|
| Spoofing | Impersonate a user/service? | Auth, signature verification |
| Tampering | Data altered in transit/at rest? | Integrity checks, parameterized queries, HTTPS |
| Repudiation | Action denied later? | Audit logging |
| Information disclosure | Data leaks? | Encryption, field allowlists, generic errors |
| Denial of service | Overwhelmed? | Rate limits, size caps, timeouts |
| Elevation of privilege | Rights they shouldn't have? | Authorization checks, least privilege |

4. **Write abuse cases next to use cases** — "how would I misuse this?" becomes the first test.

Can't name the trust boundaries → not ready to secure it (OWASP A04: most breaches begin in design).

## The Three-Tier Boundary System

### Always Do (no exceptions)

- Validate all external input at the system boundary; parameterize all queries; encode output (don't bypass framework escaping); HTTPS for external comms
- Hash passwords with bcrypt/scrypt/argon2; security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options); httpOnly+secure+sameSite session cookies
- Run the package manager's native audit against the committed lockfile before every release

### Ask First (requires human approval)

- New auth flows or auth-logic changes; new categories of sensitive data; new external integrations; CORS changes; file-upload handlers; rate-limit changes; elevated permissions

### Never Do

- Commit secrets; log sensitive data; trust client-side validation as a boundary; disable security headers for convenience; `eval()`/`innerHTML` with user data; auth tokens in client-accessible storage; expose stack traces to users

## Key rules worth remembering

- **SSRF:** any server-side fetch of a user-influenced URL needs scheme+host allowlist, all resolved IPs checked private/reserved, redirects forbidden — and there's still a TOCTOU gap (pin the IP or use a filtering agent for high-risk surfaces).
- **Dependency audits** find known advisories only — triage by reachability, never `npm audit fix --force`, review install scripts and lockfile diffs.
- **LLM output is untrusted input** — never pass to eval/SQL/shell/innerHTML; enforce permissions in code, not prompts; keep secrets and cross-tenant data out of the context; cap consumption.
- **Skills are injection vectors** — read a skill's source before installing from outside; a SKILL.md description is a prompt hiding in metadata.
- **Permission scope creep** — a permission granted "just once for convenience" never gets removed by itself; re-audit granted permissions every ~30 days.
- **Unattended runs are attack surface** — no verbose logging in long-running loops (secrets scatter into unmonitored logs); every irreversible action keeps a human gate.

→ OWASP prevention patterns with code examples, SSRF allowlist implementation, input validation, rate limiting, secrets management, LLM hardening: `references/patterns.md`
→ Dependency-audit triage tree + supply-chain hygiene: `references/supply-chain.md`
→ Full security review checklist + verification: `references/security-checklist.md`

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Internal tool, security doesn't matter" | Internal tools get compromised — weakest link. |
| "We'll add security later" | Retrofitting is 10x harder. |
| "The framework handles security" | Frameworks provide tools, not guarantees. |
| "It's just LLM output, only text" | That "text" can be SQL, a script tag, or a shell command. |
| "The audit passed, so it's safe" | Audits match *known* advisories — not newly malicious or typosquatted packages. |

## Red Flags

- User input straight into queries, shell commands, or HTML rendering
- Secrets in source or history; endpoints without auth checks; wildcard CORS
- No rate limiting on auth endpoints; stack traces exposed to users
- Server fetches user-supplied URLs without allowlist
- LLM output into a query, the DOM, a shell, or `eval`; secrets/PII in the prompt

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
