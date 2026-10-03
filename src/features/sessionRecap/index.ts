export { RecapTab } from './ui/RecapTab';
export { createSessionEventsTap, toSessionEvent } from './services/sessionEventsTap';
export { composeSessionRecaps, groupSessions } from './logic/sessionGrouper';
export type { StatusEntryLike, ComposeInput } from './logic/sessionGrouper';
export type {
  SessionRecap,
  SessionRecapStatus,
  SessionRecapStatusGroup,
} from './types';
export {
  SESSION_GROUP_GAP_MS,
  SESSION_EVENTS_MAX_AGE_DAYS,
  DERIVE_LOOKBACK_DAYS,
  LIVE_FLUSH_MS,
  TERMS_CAP,
} from './types';
