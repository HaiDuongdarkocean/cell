import type { Connection, ProviderId } from '../domain/types';

export type ProviderErrorKind = 'auth' | 'quota' | 'network' | 'rate-limit' | 'not-found' | 'unknown';

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;

  constructor(kind: ProviderErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProviderError';
    this.kind = kind;
  }
}

export interface AuthorizedAccount {
  accountKey: string;
  displayName: string;
  accessToken: string;
  expiresAt: number;
}

export interface RemoteEntry {
  path: string;
  size: number;
  modifiedAt: number;
  providerChecksum?: string;
}

export interface WriteOptions {
  readonly fresh?: boolean;
}

export interface ChangeSignal {
  peek(connection: Connection): Promise<string | null>;
  ring(connection: Connection): Promise<string>;
}

export interface StorageProvider {
  readonly providerId: ProviderId;
  readonly displayName: string;
  readonly signal?: ChangeSignal;
  authorize(opts: { interactive: boolean; accountHint?: string }): Promise<AuthorizedAccount>;
  hasToken(connection: Connection): Promise<boolean>;
  revoke(connection: Connection): Promise<void>;
  list(connection: Connection, prefix: string): Promise<RemoteEntry[]>;
  read(connection: Connection, path: string): Promise<Blob>;
  write(
    connection: Connection,
    path: string,
    body: Blob,
    opts?: WriteOptions,
  ): Promise<RemoteEntry>;
  remove(connection: Connection, path: string): Promise<void>;
  quota(connection: Connection): Promise<{ usedBytes: number; totalBytes: number | null }>;
}
