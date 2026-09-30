import { describe, expect, it } from '@jest/globals';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { MESSAGE_REGISTRY } from './registry';
import type { MessageDirection } from './registry';

const DIRECTIONS: readonly MessageDirection[] = [
  'cs->bg',
  'bg->cs',
  'panel->bg',
  'bg->offscreen',
  'offscreen->bg',
  'any',
];

describe('MESSAGE_REGISTRY', () => {
  it('has an entry for every MESSAGE_TYPES value', () => {
    for (const type of Object.values(MESSAGE_TYPES)) {
      expect(MESSAGE_REGISTRY[type]).toBeDefined();
      expect(MESSAGE_REGISTRY[type].type).toBe(type);
    }
  });

  it('has no entries beyond MESSAGE_TYPES', () => {
    const known = new Set<string>(Object.values(MESSAGE_TYPES));
    for (const key of Object.keys(MESSAGE_REGISTRY)) {
      expect(known.has(key)).toBe(true);
    }
  });

  it('entries carry a valid direction, owner, and schema-or-undefined', () => {
    for (const contract of Object.values(MESSAGE_REGISTRY)) {
      expect(DIRECTIONS).toContain(contract.direction);
      expect(typeof contract.owner).toBe('string');
      expect(contract.owner.length).toBeGreaterThan(0);
      if (contract.schema !== undefined) {
        expect(typeof contract.schema.safeParse).toBe('function');
      }
    }
  });

  it('every contract carries a payload schema (receive-side validation ratchet)', () => {
    const schemaLess = Object.values(MESSAGE_REGISTRY)
      .filter((c) => c.schema === undefined)
      .map((c) => c.type);
    expect(schemaLess).toEqual([]);
  });
});
