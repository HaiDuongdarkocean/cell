import { getDecksByCollection } from '@/features/srs/repositories/deckRepository';
import { getCardsByDeck } from '@/features/srs/repositories/cardRepository';
import { getNotesByDeck } from '@/features/srs/repositories/noteRepository';
import { getReviewEventsByTimestampRange } from '@/features/srs/repositories/reviewEventRepository';
import { getVariantPresetForDeck } from '@/features/srs/repositories/variantPresetRepository';
import type { SrsCard, SrsDeck, VariantId } from '@/entities/srs/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 42;
const SECONDS_PER_CARD = 8;
const KNOWN_AVG_PROGRESS = 50;

export interface SrsHomeDeckStat {
  readonly deck: SrsDeck;
  readonly totalCards: number;
  readonly dueNow: number;
  readonly newCount: number;
  readonly learnedPct: number;
}

export interface SrsHomeStats {
  readonly dueNow: number;
  readonly newCount: number;
  readonly studiedToday: number;
  readonly learnedWords: number;
  readonly wordsAddedToday: number;
  readonly wordsPerDay: readonly number[];
  readonly streakDays: number;
  readonly activeDayKeys: ReadonlySet<string>;
  readonly minutesLeft: number;
  readonly decks: readonly SrsHomeDeckStat[];
}

export type StreakDayLevel = 'none' | 'partial' | 'full';

export interface SrsStreakStats {
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly avgReviews14: number;
  readonly dayLevels: readonly StreakDayLevel[];
}

function isNew(card: SrsCard, variantIds: readonly VariantId[]): boolean {
  return variantIds.every((id) => (card.components[id]?.exploreCount ?? 0) === 0);
}

function avgProgress(card: SrsCard, variantIds: readonly VariantId[]): number {
  if (variantIds.length === 0) return 0;
  const sum = variantIds.reduce((acc, id) => acc + (card.components[id]?.progress ?? 0), 0);
  return sum / variantIds.length;
}

/** Local calendar day key (YYYY-M-D) after shifting the day boundary to `dayStartHour`. */
export function dayKeyFor(timestampMs: number, dayStartHour: number): string {
  const shifted = new Date(timestampMs - dayStartHour * 60 * 60 * 1000);
  return `${shifted.getFullYear()}-${shifted.getMonth() + 1}-${shifted.getDate()}`;
}

function dayStartMs(now: Date, dayStartHour: number): number {
  const start = new Date(now);
  start.setHours(dayStartHour, 0, 0, 0);
  if (start.getTime() > now.getTime()) start.setTime(start.getTime() - DAY_MS);
  return start.getTime();
}

function computeStreak(activeDayKeys: ReadonlySet<string>, dayStartHour: number, now: Date): number {
  let streak = 0;
  let offset = activeDayKeys.has(dayKeyFor(now.getTime(), dayStartHour)) ? 0 : 1;
  while (activeDayKeys.has(dayKeyFor(now.getTime() - offset * DAY_MS, dayStartHour))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

/** Aggregate dashboard stats for the SRS home screen (Migaku-style hero + deck list). */
export async function getSrsHomeStats(
  collectionId: string,
  dayStartHour = 0,
  now = new Date(),
): Promise<SrsHomeStats> {
  const decks = await getDecksByCollection(collectionId);
  const nowISO = now.toISOString();
  const todayStart = dayStartMs(now, dayStartHour);
  const events = await getReviewEventsByTimestampRange(todayStart - LOOKBACK_DAYS * DAY_MS, now.getTime());

  let dueNow = 0;
  let newCount = 0;
  let learnedWords = 0;
  let wordsAddedToday = 0;
  const wordsPerDay = new Array<number>(14).fill(0);
  const wordsDayIndex = (ts: number): number => {
    const noteStart = dayStartMs(new Date(ts), dayStartHour);
    return 13 - Math.round((todayStart - noteStart) / DAY_MS);
  };
  const deckStats: SrsHomeDeckStat[] = [];

  for (const deck of decks) {
    const [cards, notes, preset] = await Promise.all([
      getCardsByDeck(deck.id),
      getNotesByDeck(deck.id),
      getVariantPresetForDeck(deck.id).catch(() => null),
    ]);
    const variantIds = preset?.variants.map((v) => v.id) ?? Object.keys(cards[0]?.components ?? {});
    let deckDue = 0;
    let deckNew = 0;
    let deckKnown = 0;
    for (const card of cards) {
      const due = card.nextDue <= nowISO;
      if (due) deckDue += 1;
      if (due && isNew(card, variantIds)) deckNew += 1;
      if (avgProgress(card, variantIds) >= KNOWN_AVG_PROGRESS) deckKnown += 1;
    }
    for (const note of notes) {
      if (note.createdAt >= todayStart) wordsAddedToday += 1;
      const dayIndex = wordsDayIndex(note.createdAt);
      if (dayIndex >= 0 && dayIndex < 14) wordsPerDay[dayIndex] += 1;
    }
    dueNow += deckDue;
    newCount += deckNew;
    learnedWords += deckKnown;
    deckStats.push({
      deck,
      totalCards: cards.length,
      dueNow: deckDue,
      newCount: deckNew,
      learnedPct: cards.length === 0 ? 0 : Math.round((deckKnown / cards.length) * 100),
    });
  }

  const activeDayKeys = new Set(events.map((e) => dayKeyFor(e.answeredAt, dayStartHour)));
  const studiedToday = events.filter((e) => e.answeredAt >= todayStart).length;

  return {
    dueNow,
    newCount,
    studiedToday,
    learnedWords,
    wordsAddedToday,
    wordsPerDay,
    streakDays: computeStreak(activeDayKeys, dayStartHour, now),
    activeDayKeys,
    minutesLeft: Math.max(1, Math.ceil((dueNow * SECONDS_PER_CARD) / 60)),
    decks: deckStats,
  };
}

const STREAK_LOOKBACK_DAYS = 364;
const COMPLETED_REVIEWS_PER_DAY = 10;

/** Streaks detail stats: current/best streak, 14-day daily average, per-day level for the last 52 weeks. */
export async function getStreakStats(
  dayStartHour = 0,
  now = new Date(),
): Promise<SrsStreakStats> {
  const todayStart = dayStartMs(now, dayStartHour);
  const events = await getReviewEventsByTimestampRange(todayStart - STREAK_LOOKBACK_DAYS * DAY_MS, now.getTime());

  const counts = new Map<string, number>();
  for (const event of events) {
    const key = dayKeyFor(event.answeredAt, dayStartHour);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const countsPerDay: number[] = [];
  for (let i = STREAK_LOOKBACK_DAYS; i >= 0; i -= 1) {
    countsPerDay.push(counts.get(dayKeyFor(todayStart - i * DAY_MS, dayStartHour)) ?? 0);
  }

  const activeDays = countsPerDay.map((c) => c > 0);
  let bestStreak = 0;
  let run = 0;
  for (const active of activeDays) {
    run = active ? run + 1 : 0;
    if (run > bestStreak) bestStreak = run;
  }
  const currentStreak = computeStreak(new Set(counts.keys()), dayStartHour, now);
  const last14 = countsPerDay.slice(-14);
  const avgReviews14 = Math.round(last14.reduce((a, b) => a + b, 0) / last14.length);

  return {
    currentStreak,
    bestStreak,
    avgReviews14,
    // ponytail: we don't store per-day due counts, so "completed all reviews" is
    // approximated by >= COMPLETED_REVIEWS_PER_DAY events that day. Upgrade path:
    // persist a daily-goal snapshot, then mark full = reviewed >= goal.
    dayLevels: countsPerDay.map((c): StreakDayLevel => (c === 0 ? 'none' : c >= COMPLETED_REVIEWS_PER_DAY ? 'full' : 'partial')),
  };
}
