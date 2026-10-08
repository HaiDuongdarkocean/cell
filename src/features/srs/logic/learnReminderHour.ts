import {
  SRS_REMINDER_MARGIN,
  SRS_REMINDER_MIN_COUNT,
  SRS_REMINDER_MIN_STUDY_DAYS,
} from '@/shared/config/config';
import { dayKeyFor } from '@/features/srs/services/getSrsHomeStats';

export interface LearnedHourCandidate {
  readonly hour: number;
  readonly count: number;
  readonly runnerUpCount: number;
  readonly studyDays: number;
}

export function computeLearnedHour(
  events: readonly { readonly answeredAt: number }[],
  dayStartHour: number,
): LearnedHourCandidate | null {
  const firstByDay = new Map<string, number>();
  for (const event of events) {
    const key = dayKeyFor(event.answeredAt, dayStartHour);
    const prev = firstByDay.get(key);
    if (prev === undefined || event.answeredAt < prev) firstByDay.set(key, event.answeredAt);
  }
  if (firstByDay.size < SRS_REMINDER_MIN_STUDY_DAYS) return null;
  const histogram = new Array<number>(24).fill(0);
  for (const firstAt of firstByDay.values()) {
    histogram[new Date(firstAt).getHours()] += 1;
  }
  let topHour = -1;
  let topCount = 0;
  let runnerUpCount = 0;
  for (let hour = 0; hour < 24; hour += 1) {
    if (histogram[hour] > topCount) {
      runnerUpCount = topCount;
      topCount = histogram[hour];
      topHour = hour;
    } else if (histogram[hour] > runnerUpCount) {
      runnerUpCount = histogram[hour];
    }
  }
  if (topHour < 0 || topCount < SRS_REMINDER_MIN_COUNT) return null;
  return { hour: topHour, count: topCount, runnerUpCount, studyDays: firstByDay.size };
}

export function adoptLearnedCandidate(
  candidate: LearnedHourCandidate | null,
  current: number | null,
): number | null {
  if (!candidate) return null;
  if (current === null || candidate.hour === current) return candidate.hour;
  return candidate.count - candidate.runnerUpCount >= SRS_REMINDER_MARGIN ? candidate.hour : null;
}

/** First future `hour`:00 strictly after `earliestAfterMs` (local time). */
export function nextReminderFireMs(hour: number, earliestAfterMs: number): number {
  const next = new Date(earliestAfterMs);
  next.setMinutes(0, 0, 0);
  next.setHours(hour);
  if (next.getTime() <= earliestAfterMs) next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
  return next.getTime();
}
