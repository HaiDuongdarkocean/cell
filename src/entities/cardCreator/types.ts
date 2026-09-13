/** One item in the Send-to-Card review queue (I+N flow from the subtitle
 *  cluster): the target word + its pre-formatted definitions + word status.
 *  Media (screenshot + sentence audio) is shared across all items — captured
 *  once before the dialog opens. */
export interface CardCreatorQueueItem {
  readonly term: string;
  readonly definitions: string;
  readonly status: 'unknown' | 'tracking';
}
