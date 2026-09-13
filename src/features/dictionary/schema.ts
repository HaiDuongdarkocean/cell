// Re-export shim — boundary contracts live in entities/dictionary (FSD:
// entities/ must not import from features/; entities/message/registry needs
// these).

export * from '@/entities/dictionary/resourceSchemas';
