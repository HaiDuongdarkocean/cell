// Re-export shim — boundary contracts live in entities/subtitle (FSD: features
// may import entities, not the reverse; entities/message/registry needs these).

export * from '@/entities/subtitle/discoverySchemas';
