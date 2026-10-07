import type { SrsNote, SrsNotetype } from '@/entities/srs/types';

export interface PumpFieldIds {
  readonly sentenceFieldId: string | null;
  readonly audioFieldId: string | null;
  readonly termFieldId: string | null;
}

const SENTENCE_IDS = ['sentence', 'contextSentence', 'example'];
const AUDIO_IDS = ['sentAudio', 'sentenceAudio', 'audio'];
const TERM_IDS = ['target', 'targetWord', 'word', 'term'];

function pickFieldId(notetype: SrsNotetype, ids: readonly string[], type: SrsNotetype['fields'][number]['type']): string | null {
  for (const id of ids) {
    const field = notetype.fields.find((f) => f.id === id && f.type === type);
    if (field) return field.id;
  }
  return null;
}

function templateFieldId(notetype: SrsNotetype, stimulusType: string, type: SrsNotetype['fields'][number]['type']): string | null {
  for (const tpl of notetype.frontTemplates) {
    if (tpl.stimulusType !== stimulusType) continue;
    for (const fieldId of tpl.fieldIds) {
      const field = notetype.fields.find((f) => f.id === fieldId && f.type === type);
      if (field) return field.id;
    }
  }
  return null;
}

/**
 * Detect which note fields carry the pump-relevant material.
 * Order: canonical ids (`defaultNotetype`) → frontTemplates stimulusType mapping.
 * Notetypes with neither are unplayable — caller filters them out.
 */
export function detectPumpFields(notetype: SrsNotetype): PumpFieldIds {
  return {
    sentenceFieldId:
      pickFieldId(notetype, SENTENCE_IDS, 'text') ??
      pickFieldId(notetype, ['context'], 'context') ??
      templateFieldId(notetype, 'sentence', 'text'),
    audioFieldId:
      pickFieldId(notetype, AUDIO_IDS, 'audio') ?? templateFieldId(notetype, 'sentence-audio', 'audio'),
    termFieldId: pickFieldId(notetype, TERM_IDS, 'text'),
  };
}

export function pumpFieldText(note: SrsNote, fieldId: string | null): string | null {
  if (!fieldId) return null;
  const value = note.fields[fieldId];
  if (!value || value.kind === 'audio' || value.kind === 'image' || value.kind === 'list') return null;
  const text = value.value.trim();
  return text.length > 0 ? text : null;
}
