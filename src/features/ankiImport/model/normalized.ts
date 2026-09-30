import type { SrsField } from '@/entities/srs/types';

export type FieldRole =
  | 'target'
  | 'definition'
  | 'sentence'
  | 'translation'
  | 'context'
  | 'audio'
  | 'image'
  | 'notes'
  | 'skip';

export interface NormalizedAnkiField {
  readonly name: string;
  readonly ord: number;
}

export interface NormalizedAnkiNotetype {
  readonly id: string;
  readonly name: string;
  readonly fields: readonly NormalizedAnkiField[];
  readonly isCloze: boolean;
}

export interface NormalizedAnkiDeck {
  readonly id: string;
  readonly name: string; // raw 'A::B::C'
  readonly filtered: boolean; // dyn=1
  readonly desiredRetention?: number; // 0..1, when the source exposes it
}

export interface NormalizedAnkiNote {
  readonly id: number;
  readonly modelId: string; // NormalizedAnkiNotetype.id
  readonly fields: readonly string[]; // raw HTML, ordered by field ord
  readonly tags: readonly string[];
}

export interface NormalizedAnkiCard {
  readonly id: number;
  readonly noteId: number;
  readonly deckId: string; // home deck id (odid-resolved by adapters)
  readonly ord: number;
  readonly type: number; // 0 new · 1 learning · 2 review · 3 relearning
  readonly queue: number; // -1 suspended · -2/-3 buried · 0 new · 1 learn · 2 review · 3 day-learn
  readonly due: number; // semantics depend on queue — see stateConvert
  readonly ivl: number;
  readonly factor: number;
  readonly reps: number;
  readonly lapses: number;
  readonly left: number;
  readonly odid: number; // original deck id when the card sits in a filtered deck (0 otherwise)
  readonly memoryState?: { readonly stability: number; readonly difficulty: number };
}

export interface NormalizedAnkiRevlog {
  readonly id: number; // epoch ms of the answer
  readonly cardId: number;
  readonly ease: number; // 1=again 2=hard 3=good 4=easy
  readonly ivl: number;
  readonly time: number; // review duration ms
}

export type MediaResolver = (filename: string) => Promise<{ bytes: ArrayBuffer; mimeType: string } | null>;

export interface NormalizedAnkiData {
  readonly source: 'apkg' | 'ankiconnect';
  readonly fidelity: 'full' | 'estimated';
  readonly hasScheduling: boolean;
  readonly crtMs: number | null; // collection creation time — null on AnkiConnect
  readonly decks: readonly NormalizedAnkiDeck[];
  readonly notetypes: readonly NormalizedAnkiNotetype[];
  readonly notes: readonly NormalizedAnkiNote[];
  readonly cards: readonly NormalizedAnkiCard[];
  readonly revlog: readonly NormalizedAnkiRevlog[];
  readonly media: {
    readonly names: readonly string[];
    readonly resolve: MediaResolver;
  };
}

/** Field-role mapping keyed by Anki field name, per notetype. */
export type FieldMapping = Record<string, FieldRole>;

export interface ImportSelection {
  readonly deckIds: ReadonlySet<string>;
  readonly notetypeIds: ReadonlySet<string>;
}

/** Maps FieldRole → SrsField['type'] for synthesized notetypes. */
export const ROLE_TO_FIELD_TYPE: Record<FieldRole, SrsField['type']> = {
  target: 'text',
  definition: 'text',
  sentence: 'text',
  translation: 'translation',
  context: 'context',
  audio: 'audio',
  image: 'image',
  notes: 'text',
  skip: 'text',
};
