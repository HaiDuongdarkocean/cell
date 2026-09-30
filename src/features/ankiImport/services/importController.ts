import { sendAction } from '@/features/cardCreator';
import { parseApkg } from '../adapters/apkgAdapter';
import { readViaAnkiConnect } from '../adapters/connectAdapter';
import type { NormalizedAnkiData } from '../model/normalized';
import { createBackgroundInvoker, getStoredAnkiConnectUrl } from './connectTransport';
import type { ConnectReadOptions } from '../adapters/connectAdapter';

export type SourceKind = 'connect' | 'apkg';

/** Ping the saved (or given) AnkiConnect URL. */
export async function checkAnkiConnect(url?: string): Promise<boolean> {
  const target = url ?? (await getStoredAnkiConnectUrl());
  const result = await sendAction(target, 'version');
  return result.ok;
}

export async function readFromConnect(opts: ConnectReadOptions = {}): Promise<NormalizedAnkiData> {
  const url = await getStoredAnkiConnectUrl();
  return readViaAnkiConnect(createBackgroundInvoker(url), opts);
}

export async function readFromApkg(file: File): Promise<NormalizedAnkiData> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return parseApkg(bytes);
}
