# Research — invisible web-session AI bridging

Question: how do market apps call web-session AI (ChatGPT/Gemini/DeepSeek/Claude)
without showing the provider page, and how do they check login state first?

## Market patterns found (SIFT)

### Pattern A — direct internal-API calls from the extension (fully invisible)

The extension never opens a page; the service worker calls the provider's own
backend endpoints with the user's session cookies.

| App | Mechanism | Source authority |
|---|---|---|
| Summary with ChatGPT (extension) | `POST chat.openai.com/backend-api/conversation`, SSE stream, web session | amibeingpwned.com teardown — medium |
| ai-chat-exporter (Tampermonkey + extension) | per-provider adapters: ChatGPT Bearer from `/api/auth/session`; Gemini `batchexecute` + `SNlM0e` XSRF; DeepSeek Bearer from localStorage; Grok cookie session | github.com/wanda1416/ai-chat-exporter — medium |
| gemini-web2api / Gemini Nexus | `StreamGenerate` RPC, `at`/`f.sid`/`bl` tokens harvested from `/app` HTML | github docs — medium |

Cost: per-provider private-API clients (undocumented, unversioned).
ChatGPT added `sentinel/chat-requirements` proof tokens (minified-JS derived) —
direct API calls now hit "unusual activity" without them
(stackoverflow.com/q/79152195 — high). DeepSeek's Bearer lives in
`localStorage`, invisible to SW fetch — needs a one-time content-script harvest.

### Pattern B — offscreen document + iframe (officially supported, still breaks)

`chrome.offscreen` hidden document → `<iframe>` to the provider →
`scripting.registerContentScripts({allFrames:true})` inside the iframe →
`declarativeNetRequest` strips `X-Frame-Options`/CSP `frame-ancestors`
(chromium-extensions thread + SO #76268275 — high).

Blocker for login-gated providers: the iframe is a **third-party context** —
`SameSite=Lax` session cookies do not flow in, so the page loads logged-out.
Cloudflare frame-detection (`window.top !== self`) is a second failure line.
Verdict: unusable for authenticated providers.

### Pattern C — hidden window/tab DOM automation (what market DOM tools do)

chatgpt-gateway + GPTAPIByBrowser: reuse or open a ChatGPT tab, drive the DOM —
they document "don't type in the provider tab during a request" as the only
limitation (github READMEs — medium). The tab exists in the window manager but
the user never watches it work.

### Pattern D — session-endpoint probe for the login guard (invisible check)

Checking "is the user logged in" does NOT need a page:

| Provider | Probe (SW `fetch`, `credentials:'include'` + host_permissions) |
|---|---|
| ChatGPT | `GET /api/auth/session` → JSON with `accessToken`/`user` when logged in |
| Gemini | `GET /app` → HTML contains `SNlM0e` token when logged in |
| DeepSeek | `chrome.cookies.getAll({domain})` session-cookie presence, or `/api/v0/` probe → 401 |
| Claude | `GET /api/organizations` → 200 vs 401/redirect |

## Decision matrix (weights sum 100%)

| Criterion | Weight | A: session-API | B: offscreen iframe | C: hidden window + probe |
|---|---|---|---|---|
| Truly invisible UX | 30 | 10 | 8 (if it worked) | 7 (taskbar icon only) |
| Login session actually works | 25 | 8 | 2 (SameSite/CF) | 10 |
| Brittleness (selector/API drift) | 20 | 4 (private API + sentinel) | 4 | 6 (DOM selectors) |
| Build effort from current code | 15 | 3 | 5 | 9 |
| ToS/abuse-detection exposure | 10 | 4 | 5 | 5 |
| **Weighted** | | **5.6** | **4.2** | **7.6** |

## Recommendation — C + D

1. Keep DOM automation; run provider tabs in a **minimized window** (done —
   `ensureBridgeTabId` uses `windows.create({state:'minimized', focused:false})`).
   The user never sees the conversation; the window sits in the taskbar but
   displays nothing.
2. Add an **invisible login guard** (Pattern D): SW probes the session endpoint
   per provider before opening any tab. Logged in → ask proceeds silently.
   Not logged in → popup shows the `dict.ai.loginRequired` state; the provider
   tab is restored+focused only then (user must act on it).
3. Rejected: Pattern A (session-API) — true invisibility but doubles the
   breakable surface (private APIs + ChatGPT sentinel proofs) and raises
   abuse-detection exposure. Revisit only if minimized windows prove annoying.
   Pattern B dead on SameSite=Lax session cookies.

## Residual risk

Minimized window still appears in taskbar/Alt-Tab on Windows — no Chrome API
hides a tab/window completely; every market DOM-automation tool shares this
limit. Direct-API is the only path to zero window presence, at the cost above.
