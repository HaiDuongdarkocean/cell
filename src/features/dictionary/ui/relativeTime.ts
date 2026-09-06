// relativeTime — tiny Vietnamese relative-time formatter for resource cards.
//
// shared/utils/timeUtils.ts only covers subtitle timestamp formats and
// shared/ui/Timestamp defaults to English; this helper produces the exact
// Vietnamese phrasing from the design brief: "hôm nay", "hôm qua",
// "N ngày trước", "N tháng trước" (and "N năm trước" for very old imports).

const DAY_MS = 24 * 60 * 60 * 1000;

/** Format an epoch-ms timestamp as short Vietnamese relative time. */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  if (!Number.isFinite(timestamp)) return '';
  const days = Math.floor((now - timestamp) / DAY_MS);
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'hôm qua';
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} tháng trước`;
  const years = Math.floor(days / 365);
  return `${Math.max(years, 1)} năm trước`;
}
