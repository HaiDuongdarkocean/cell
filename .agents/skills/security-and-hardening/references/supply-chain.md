# Security — dependency audit triage & supply chain

## Triage tree for audit findings

Package-manager audits report *known advisories* — they don't prove a package is trustworthy or that vulnerable code is reachable.

```
The native audit reports a vulnerability
├── Severity: critical or high
│   ├── Vulnerable code reachable in runtime/build/test/deploy paths?
│   │   ├── YES → fix immediately (update, patch, or replace)
│   │   └── NO (confirmed unused) → fix soon, not a blocker
│   └── Fix available?
│       ├── YES → update to the patched version
│       └── NO → workarounds, replace the dependency, or allowlist with a review date
├── Severity: moderate
│   ├── Reachable in production? → fix in the next release cycle
│   └── Dev-only? → fix when convenient, track in backlog
└── Severity: low → track; fix during regular dependency updates
```

Key questions: is the vulnerable function actually called? Runtime dep or dev-only? Exploitable given your deployment context (e.g., a server-side vuln in a client-only app)?

When you defer a fix, document the reason and set a review date.

## Supply-chain hygiene

1. **Find the installation boundary and manager.** Use the workspace root that owns the lockfile. Corroborate `packageManager`, the lockfile, and CI; stop on disagreement or competing lockfiles. Pin the manager version.
2. **Block dependency scripts before first execution.** Bootstrap with scripts disabled or a documented fail-closed policy; inspect pending script source; approve only the minimum required packages; commit the policy; verify with a clean frozen/immutable install. Never blanket-approve scripts.
3. **Never apply forced audit remediation automatically** (`npm audit fix --force`). Preview remediation, read changelogs, test each upgrade — forced fixes may cross declared ranges.
4. **Verify registry signatures/provenance where supported** (`npm audit signatures`, `pnpm audit signatures`); treat absence as a signal to investigate, not proof of compromise.
5. **Review new dependencies, lockfile diffs, and script-policy changes together** — ownership, maintenance, release age, provenance, transitive graph, typosquats (`cross-env` vs `crossenv`). OWASP A06, LLM03.
