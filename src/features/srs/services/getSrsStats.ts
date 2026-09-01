import { getCardsByDeck } from '@/features/srs/repositories/cardRepository';
import { getNotesByDeck } from '@/features/srs/repositories/noteRepository';
import { getReviewEventsByTimestampRange } from '@/features/srs/repositories/reviewEventRepository';

export interface SrsDeckStats {
  readonly totalNotes: number;
  readonly totalCards: number;
  readonly dueNow: number;
  readonly dueNext24h: number;
  readonly studiedToday: number;
}

/** Compute simple deck-level study statistics. */
export async function getSrsStats(deckId: string, now = new Date()): Promise<SrsDeckStats> {
  const [notes, cards] = await Promise.all([getNotesByDeck(deckId), getCardsByDeck(deckId)]);

  const nowISO = now.toISOString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const dueNow = cards.filter((c) => c.nextDue <= nowISO).length;
  const dueNext24h = cards.filter((c) => c.nextDue <= tomorrow).length;

  const eventsToday = await getReviewEventsByTimestampRange(startOfDay, now.getTime());
  const studiedToday = eventsToday.length;

  return {
    totalNotes: notes.length,
    totalCards: cards.length,
    dueNow,
    dueNext24h,
    studiedToday,
  };
}
