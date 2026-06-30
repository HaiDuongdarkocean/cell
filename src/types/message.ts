/**
 * Message types — barrel re-export from entities/message (Strangler Fig).
 *
 * Existing `@/types/message` imports continue to work. New code SHOULD
 * import from `@/entities/message`.
 */
export * from '@/entities/message/types';
