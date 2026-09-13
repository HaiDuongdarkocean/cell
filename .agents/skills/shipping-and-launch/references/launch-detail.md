# Shipping — full checklists & templates

## Full pre-launch checklist

### Code quality
- [ ] All tests pass (unit, integration, e2e); build succeeds with no warnings
- [ ] Lint + typecheck pass; code reviewed and approved
- [ ] No launch-blocking TODOs; no `console.log` debugging in production code
- [ ] Error handling covers expected failure modes

### Security
- [ ] No secrets in code or version control; `npm audit` clean of critical/high
- [ ] Input validation on all user-facing endpoints; auth checks in place
- [ ] Security headers (CSP, HSTS); rate limiting on auth endpoints; scoped CORS

### Performance
- [ ] CWV within "Good"; no N+1 in critical paths; images optimized (compression, responsive sizes, lazy)
- [ ] Bundle within budget; queries indexed; caching configured

### Accessibility
- [ ] Keyboard navigation; screen reader conveys content/structure; WCAG 2.1 AA contrast (4.5:1)
- [ ] Focus management for modals/dynamic content; descriptive error messages tied to fields
- [ ] No axe-core/Lighthouse warnings (`e2e/showcase-axe.spec.ts`)

### Infrastructure
- [ ] Env vars set in production; migrations applied/ready; DNS + SSL; CDN for static assets
- [ ] Logging + error reporting configured; health check endpoint responds

### Documentation
- [ ] README setup current; API docs current; ADRs for architectural decisions; changelog updated; user-facing docs updated

## Feature flag example

```typescript
const flags = await getFeatureFlags(userId);
if (flags.taskSharing) return <TaskSharingPanel task={task} />;
return null;
```

## What to monitor

```text
Application: error rate (total + per endpoint) · p50/p95/p99 latency · request volume · active users · business metrics
Infrastructure: CPU/memory · DB connection pool · disk · network latency · queue depth
Client: CWV (LCP, INP, CLS) · JS errors · client-side API error rates · page load time
```

## Error reporting patterns

```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, {
      componentStack: info.componentStack,
      userId: getCurrentUser()?.id,
      page: window.location.pathname,
    });
  }
}

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  reportError(err, { method: req.method, url: req.url, userId: req.user?.id });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
});
```

## Rollback plan template

```markdown
## Rollback Plan for [Feature/Release]

### Trigger Conditions
- Error rate > 2x baseline
- P95 latency > [X]ms
- User reports of [specific issue]

### Rollback Steps
1. Disable feature flag (if applicable)
   OR
1. Deploy previous version: `git revert <commit> && git push`
2. Verify rollback: health check, error monitoring
3. Communicate: notify team

### Database Considerations
- Migration [X] has a rollback: `npx prisma migrate rollback`
- Data inserted by new feature: [preserved / cleaned up]

### Time to Rollback
- Feature flag: < 1 minute
- Redeploy previous version: < 5 minutes
- Database rollback: < 15 minutes
```

## See also

- Definition of Done / deterministic gates: `docs/knowledge-base/agentic-sdlc.md`
- Security pre-launch: `security-and-hardening` · Performance: `performance-optimization`
