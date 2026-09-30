import { getDecksByCollection } from '@/features/srs/repositories/deckRepository';
import { getCardsByDeck } from '@/features/srs/repositories/cardRepository';
import { getNotesByDeck } from '@/features/srs/repositories/noteRepository';
import { getReviewEventsByTimestampRange } from '@/features/srs/repositories/reviewEventRepository';
import type { ComponentType, SrsCard, SrsDeck } from '@/entities/srs/types';

const COMPONENT_TYPES: readonly ComponentType[] = ['sound', 'meaning', 'spelling'];
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
  readonly streakDays: number;
  readonly activeDayKeys: ReadonlySet<string>;
  readonly minutesLeft: number;
  readonly decks: readonly SrsHomeDeckStat[];
}

function isNew(card: SrsCard): boolean {
  return COMPONENT_TYPES.every((type) => card.components[type].exploreCount === 0);
}

function avgProgress(card: SrsCard): number {
  const sum = COMPONENT_TYPES.reduce((acc, type) => acc + card.components[type].progress, 0);
  return sum / COMPONENT_TYPES.length;
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
  const deckStats: SrsHomeDeckStat[] = [];

  for (const deck of decks) {
    const [cards, notes] = await Promise.all([getCardsByDeck(deck.id), getNotesByDeck(deck.id)]);
    let deckDue = 0;
    let deckNew = 0;
    let deckKnown = 0;
    for (const card of cards) {
      const due = card.nextDue <= nowISO;
      if (due) deckDue += 1;
      if (due && isNew(card)) deckNew += 1;
      if (avgProgress(card) >= KNOWN_AVG_PROGRESS) deckKnown += 1;
    }
    for (const note of notes) {
      if (note.createdAt >= todayStart) wordsAddedToday += 1;
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
    streakDays: computeStreak(activeDayKeys, dayStartHour, now),
    activeDayKeys,
    minutesLeft: Math.max(1, Math.ceil((dueNow * SECONDS_PER_CARD) / 60)),
    decks: deckStats,
  };
}
