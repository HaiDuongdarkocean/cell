# Performance — bottleneck tables & fix patterns

## Measuring

```typescript
// RUM: Web Vitals in code
import { onLCP, onINP, onCLS } from 'web-vitals';
onLCP(console.log); onINP(console.log); onCLS(console.log);

// Simple backend timing
console.time('db-query');
const result = await db.query(...);
console.timeEnd('db-query');
```

## Bottleneck identification

**Frontend:**

| Symptom | Likely cause | Investigation |
|---|---|---|
| Slow LCP | Large images, render-blocking resources, slow server | Network waterfall, image sizes |
| High CLS | Images without dimensions, late content, font shifts | Layout-shift attribution |
| Poor INP | Heavy main-thread JS, large DOM updates | Long tasks in Performance trace |
| Slow initial load | Large bundle, many requests | Bundle size, code splitting |

**Backend:**

| Symptom | Likely cause | Investigation |
|---|---|---|
| Slow API responses | N+1, missing indexes, unoptimized queries | Query log |
| Memory growth | Leaked references, unbounded caches, large payloads | Heap snapshot |
| CPU spikes | Sync heavy computation, regex backtracking | CPU profiling |
| High latency | Missing caching, redundant computation, network hops | Trace through the stack |

## Fix patterns

### N+1 queries

```typescript
// BAD
const tasks = await db.tasks.findMany();
for (const task of tasks) {
  task.owner = await db.users.findUnique({ where: { id: task.ownerId } });
}
// GOOD
const tasks = await db.tasks.findMany({ include: { owner: true } });
```

### Unbounded fetching

```typescript
const tasks = await db.tasks.findMany({
  take: 20,
  skip: (page - 1) * 20,
  orderBy: { createdAt: 'desc' },
});
```

### Images

```html
<!-- Hero / LCP: art direction + resolution switching + high priority -->
<picture>
  <source media="(max-width: 767px)"
    srcset="/hero-mobile-400.avif 400w, /hero-mobile-800.avif 800w"
    sizes="100vw" width="800" height="1000" type="image/avif" />
  <source srcset="/hero-800.avif 800w, /hero-1600.avif 1600w"
    sizes="(max-width: 1200px) 100vw, 1200px" width="1200" height="600" type="image/avif" />
  <img src="/hero-desktop.jpg" width="1200" height="600" fetchpriority="high" alt="Hero" />
</picture>

<!-- Below the fold: lazy + async decoding -->
<img src="/content.webp" width="800" height="400" loading="lazy" decoding="async" alt="Content" />
```

### React re-renders

```tsx
// BAD: new object every render
function TaskList() {
  return <TaskFilters options={{ sortBy: 'date', order: 'desc' }} />;
}
// GOOD: stable reference
const DEFAULT_OPTIONS = { sortBy: 'date', order: 'desc' } as const;

const TaskItem = React.memo(function TaskItem({ task }: Props) { /* expensive render */ });

function TaskStats({ tasks }: Props) {
  const stats = useMemo(() => calculateStats(tasks), [tasks]);
  return <div>{stats.completed} / {stats.total}</div>;
}
```

### Bundle / code splitting

```typescript
// Named imports already tree-shake in Vite/webpack5 when the dep ships ESM + sideEffects:false.
// Real gains: dynamic import + route-level splitting.
const ChartLibrary = lazy(() => import('./ChartLibrary'));
const SettingsPage = lazy(() => import('./pages/Settings'));
```

### Caching

```typescript
// Hot-read TTL cache
const CACHE_TTL = 5 * 60 * 1000;
let cachedConfig: AppConfig | null = null;
let cacheExpiry = 0;

// Static assets: content-hashed names + immutable
app.use('/static', express.static('public', { maxAge: '1y', immutable: true }));
res.set('Cache-Control', 'public, max-age=300');
```

## Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll optimize later" | Perf debt compounds — fix obvious anti-patterns now. |
| "It's fast on my machine" | Profile on representative hardware/networks. |
| "This optimization is obvious" | Unmeasured = unknown. |
| "Users won't notice 100ms" | 100ms measurably impacts conversion. |
| "The framework handles performance" | Frameworks can't fix N+1 or oversized bundles. |
