import { describe, it, expect } from '@jest/globals';
import { validateModeName } from './validateModeName';
import type { StudyMode } from '@/entities/studyMode';

const existing: StudyMode[] = [
  { id: 'a', type: 'custom', icon: 'play', title: 'Shadowing', description: '', steps: [] },
];

describe('validateModeName', () => {
  it('accepts a unique non-empty name', () => {
    const result = validateModeName('My combo', existing);
    expect(result).toEqual({ valid: true });
  });

  it('rejects empty name', () => {
    const result = validateModeName('   ', existing);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Name is required');
  });

  it('rejects names over 50 chars', () => {
    const result = validateModeName('a'.repeat(51), existing);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Name must be 50 characters or less');
  });

  it('rejects duplicate name case-insensitively', () => {
    const result = validateModeName('shadowing', existing);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Name already exists');
  });

  it('allows editing the same mode to keep its name', () => {
    const result = validateModeName('Shadowing', existing, 'a');
    expect(result).toEqual({ valid: true });
  });
});
