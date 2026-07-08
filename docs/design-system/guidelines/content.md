# Content Guidelines — Cell Extension

| Guidance | Level | Rationale |
|---|---|---|
| New component: provide purpose + API + usage guidelines before merging | must | Component without docs = component without contract |
| Labels: plain language, no jargon ("Enable WebSocket fallback" → "Use real-time updates") | must | Jargon excludes non-technical users |

## Examples

| Guidance | ✅ Do | ❌ Don't |
|---|---|---|
| New component: provide purpose + API + usage before merge | Add `SubtitlePreview` → update [../components/](../components/) + write JSDoc + add usage guide entry | Merge component, "document later" |
| Plain language, no jargon | "Use real-time updates" | "Enable WebSocket fallback" |
