// Options data contract — Zod schema (runtime validation tại boundary).
// UI validates data từ IndexedDB/message passing trước khi render.
// Test (TDD) dùng Schema.parse() để chấm pass/fail.

import { z } from 'zod';
import type { ResourcesPanelState, Tab, SidebarItem } from './types';

// === Logic output → UI input schemas ===

export const ResourceInfoSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1),
  langCode: z.string().min(2),
  type: z.enum(['FREQUENCY', 'DICTIONARY']),
  format: z.enum(['txt', 'json-array', 'yomitan', 'sqlite', 'cambridge-json']),
  signature: z.string().min(1),
  wordCount: z.number().int().min(0),
  installationFinished: z.boolean(),
  importedAt: z.number().int().min(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ResourcesPanelStateSchema = z.object({
  resources: z.array(ResourceInfoSchema),
  loading: z.boolean(),
  importing: z.boolean(),
  progress: z.number().min(0).max(100),
  progressTotal: z.number().int().min(0),
  error: z.string().nullable(),
  success: z.string().nullable(),
});

export const TabSchema = z.enum(['resources', 'theme', 'settings']);

export const SidebarItemSchema = z.object({
  id: TabSchema,
  label: z.string().min(1),
  icon: z.string().min(1),
});

// === Type guards (runtime validation helpers) ===

export function isResourcesPanelState(x: unknown): x is ResourcesPanelState {
  return ResourcesPanelStateSchema.safeParse(x).success;
}

export function isTab(x: unknown): x is Tab {
  return TabSchema.safeParse(x).success;
}

export function isSidebarItem(x: unknown): x is SidebarItem {
  return SidebarItemSchema.safeParse(x).success;
}
