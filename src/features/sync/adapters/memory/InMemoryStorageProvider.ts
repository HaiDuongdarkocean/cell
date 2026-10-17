import { bytesToHex } from '@/shared/lib/codec';
import type { AccountKey, Connection, ConnectionId, ProviderId } from '../../domain/types';
import type { Clock } from '../../ports/clock';
import { ProviderError } from '../../ports/storageProvider';
import type {
  AuthorizedAccount,
  ChangeSignal,
  ProviderErrorKind,
  RemoteEntry,
  StorageProvider,
} from '../../ports/storageProvider';
import { blobToBytes } from '../contract/blobBytes';
import { SeededClock } from './SeededClock';

interface StoredBlob {
  bytes: Uint8Array;
  modifiedAt: number;
  seq: number;
  checksum?: string;
}

interface StoredAccount {
  accountKey: AccountKey;
  displayName: string;
}

export interface InMemoryStorageProviderOptions {
  providerId?: ProviderId;
  displayName?: string;
  clock?: Clock;
  quotaBytes?: number | null;
  tokenTtlMs?: number;
}

export class InMemoryStorageProvider implements StorageProvider {
  readonly providerId: ProviderId;
  readonly displayName: string;

  private readonly clockNow: () => number;
  private readonly tokenTtlMs: number;
  private quotaBytes: number | null;
  private readonly accounts = new Map<AccountKey, StoredAccount>();
  private readonly revoked = new Set<ConnectionId>();
  private readonly files = new Map<ConnectionId, Map<string, StoredBlob[]>>();
  private readonly bellVersions = new Map<AccountKey, number>();
  private readonly pendingFailures: { kind: ProviderErrorKind; message: string }[] = [];
  private nextAccountSeq = 1;
  private nextTokenSeq = 1;
  private nextBlobSeq = 1;

  constructor(options: InMemoryStorageProviderOptions = {}) {
    this.providerId = options.providerId ?? 'in-memory';
    this.displayName = options.displayName ?? 'In-memory storage';
    const clock = options.clock ?? new SeededClock(0);
    this.clockNow = () => clock.now();
    this.quotaBytes = options.quotaBytes ?? null;
    this.tokenTtlMs = options.tokenTtlMs ?? 3_600_000;
  }

  async authorize(opts: { interactive: boolean; accountHint?: string }): Promise<AuthorizedAccount> {
    this.gate();
    if (!opts.interactive) {
      const known = this.findAccount(opts.accountHint);
      if (!known) throw new ProviderError('auth', 'silent authorization failed');
      return this.issueToken(known);
    }
    const hinted = this.findAccount(opts.accountHint);
    if (hinted) return this.issueToken(hinted);
    const n = this.nextAccountSeq;
    this.nextAccountSeq += 1;
    const account: StoredAccount = {
      accountKey: `acct-${n}`,
      displayName: opts.accountHint ?? `user${n}@in-memory.test`,
    };
    this.accounts.set(account.accountKey, account);
    return this.issueToken(account);
  }

  async hasToken(connection: Connection): Promise<boolean> {
    return (
      this.accounts.has(connection.accountKey) &&
      !this.revoked.has(connection.connectionId)
    );
  }

  async revoke(connection: Connection): Promise<void> {
    this.gate();
    this.revoked.add(connection.connectionId);
  }

  async list(connection: Connection, prefix: string): Promise<RemoteEntry[]> {
    this.gate();
    const store = this.storeFor(connection);
    const out: RemoteEntry[] = [];
    for (const [path, copies] of store) {
      if (!path.startsWith(prefix)) continue;
      out.push(this.toEntry(path, newest(copies)));
    }
    return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  async read(connection: Connection, path: string): Promise<Blob> {
    this.gate();
    const copies = this.storeFor(connection).get(path);
    if (!copies || copies.length === 0) {
      throw new ProviderError('not-found', `no such path: ${path}`);
    }
    return new Blob([newest(copies).bytes.slice()]);
  }

  async write(connection: Connection, path: string, body: Blob): Promise<RemoteEntry> {
    this.gate();
    const store = this.storeFor(connection);
    const bytes = await blobToBytes(body);
    const replaced = (store.get(path) ?? []).reduce((sum, f) => sum + f.bytes.byteLength, 0);
    const usedAfter = usedBytes(store) - replaced + bytes.byteLength;
    if (this.quotaBytes !== null && usedAfter > this.quotaBytes) {
      throw new ProviderError('quota', `quota exceeded: ${usedAfter} > ${this.quotaBytes}`);
    }
    const blob: StoredBlob = {
      bytes,
      modifiedAt: this.clockNow(),
      seq: this.nextBlobSeq,
      checksum: await digest(bytes),
    };
    this.nextBlobSeq += 1;
    store.set(path, [blob]);
    return this.toEntry(path, blob);
  }

  async remove(connection: Connection, path: string): Promise<void> {
    this.gate();
    if (!this.storeFor(connection).delete(path)) {
      throw new ProviderError('not-found', `no such path: ${path}`);
    }
  }

  async quota(connection: Connection): Promise<{ usedBytes: number; totalBytes: number | null }> {
    this.gate();
    return { usedBytes: usedBytes(this.storeFor(connection)), totalBytes: this.quotaBytes };
  }

  readonly signal: ChangeSignal = {
    peek: async (connection: Connection): Promise<string | null> => {
      this.gate();
      this.requireConnection(connection);
      const version = this.bellVersions.get(connection.accountKey);
      return version === undefined ? null : String(version);
    },
    ring: async (connection: Connection): Promise<string> => {
      this.gate();
      this.requireConnection(connection);
      const version = (this.bellVersions.get(connection.accountKey) ?? 0) + 1;
      this.bellVersions.set(connection.accountKey, version);
      return String(version);
    },
  };

  failNext(count: number, kind: ProviderErrorKind, message = 'injected provider failure'): void {
    for (let i = 0; i < count; i += 1) {
      this.pendingFailures.push({ kind, message });
    }
  }

  setQuotaBytes(totalBytes: number | null): void {
    this.quotaBytes = totalBytes;
  }

  async seedDuplicate(
    connection: Connection,
    path: string,
    body: Blob,
    opts?: { modifiedAt?: number },
  ): Promise<void> {
    const store = this.storeFor(connection);
    const copies = store.get(path) ?? [];
    const bytes = await blobToBytes(body);
    copies.push({
      bytes,
      modifiedAt: opts?.modifiedAt ?? this.clockNow(),
      seq: this.nextBlobSeq,
      checksum: await digest(bytes),
    });
    this.nextBlobSeq += 1;
    store.set(path, copies);
  }

  countCopies(connection: Connection, path: string): number {
    this.requireConnection(connection);
    return this.files.get(connection.connectionId)?.get(path)?.length ?? 0;
  }

  private gate(): void {
    const failure = this.pendingFailures.shift();
    if (failure) throw new ProviderError(failure.kind, failure.message);
  }

  private requireConnection(connection: Connection): ConnectionId {
    if (connection.providerId !== this.providerId || !this.accounts.has(connection.accountKey)) {
      throw new ProviderError('auth', `unknown account: ${connection.accountKey}`);
    }
    if (this.revoked.has(connection.connectionId)) {
      throw new ProviderError('auth', `connection revoked: ${connection.connectionId}`);
    }
    return connection.connectionId;
  }

  private storeFor(connection: Connection): Map<string, StoredBlob[]> {
    const id = this.requireConnection(connection);
    let store = this.files.get(id);
    if (!store) {
      store = new Map();
      this.files.set(id, store);
    }
    return store;
  }

  private findAccount(hint?: string): StoredAccount | undefined {
    if (!hint) return undefined;
    for (const account of this.accounts.values()) {
      if (account.accountKey === hint || account.displayName === hint) return account;
    }
    return undefined;
  }

  private issueToken(account: StoredAccount): AuthorizedAccount {
    this.revoked.delete(`${this.providerId}:${account.accountKey}` as ConnectionId);
    const token: AuthorizedAccount = {
      accountKey: account.accountKey,
      displayName: account.displayName,
      accessToken: `tok-${account.accountKey}-${this.nextTokenSeq}`,
      expiresAt: this.clockNow() + this.tokenTtlMs,
    };
    this.nextTokenSeq += 1;
    return token;
  }

  private toEntry(path: string, blob: StoredBlob): RemoteEntry {
    const entry: RemoteEntry = {
      path,
      size: blob.bytes.byteLength,
      modifiedAt: blob.modifiedAt,
    };
    if (blob.checksum !== undefined) entry.providerChecksum = blob.checksum;
    return entry;
  }
}

function newest(copies: StoredBlob[]): StoredBlob {
  let best = copies[0]!;
  for (const copy of copies) {
    const newer = copy.modifiedAt > best.modifiedAt
      || (copy.modifiedAt === best.modifiedAt && copy.seq > best.seq);
    if (newer) best = copy;
  }
  return best;
}

function usedBytes(store: Map<string, StoredBlob[]>): number {
  let total = 0;
  for (const copies of store.values()) {
    for (const copy of copies) total += copy.bytes.byteLength;
  }
  return total;
}

async function digest(bytes: Uint8Array): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return undefined;
  const buf = await subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return bytesToHex(buf);
}
