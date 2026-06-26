# ADR-001: Use Zustand instead of Redux

## Context
Popup UI cần state management cho: videos, subtitles, downloads, settings. Team familiar với Redux pattern.

## Decision
Use Zustand 5 for popup state management. Do not use Redux.

## Rationale
- **Bundle size**: Zustand ~1KB minified, Redux ~3KB + middleware (thunk, logger, saga) → Zustand nhỏ hơn 3x
- **Boilerplate**: Redux requires actions, reducers, dispatch, connect, middleware setup. Zustand requires only store + hooks → Redux boilerplate ~200 lines, Zustand ~20 lines
- **TypeScript**: Zustand has first-class TS support with inferred types. Redux requires separate @reduxjs/toolkit or manual typing.
- **Simplicity**: Popup state is local to popup (no cross-tab persistence needed). Zustand simpler for this use case.
- **DevTools**: Zustand DevTools available (optional). Redux DevTools richer but overkill for popup state.

## Consequences
- Positive: Smaller bundle, less boilerplate, faster development
- Positive: Easier onboarding for new team members (less Redux complexity)
- Negative: If project scales to complex async orchestration across many tabs, Redux might be needed later
- Negative: Zustand DevTools less mature than Redux DevTools

## Alternatives Considered
- **Redux Toolkit**: More powerful but overkill for popup-only state. Chose Zustand for simplicity.
- **React Context + useReducer**: No external dependency, but performance issues with many re-renders. Zustand better for this case.
- **Jotai**: Similar to Zustand but less adoption. Chose Zustand for community familiarity.

## Status
Accepted. Implemented in `src/popup/store/popupStore.ts`.
