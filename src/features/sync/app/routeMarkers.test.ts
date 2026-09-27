import { InMemoryStorageProvider } from '../adapters/memory/InMemoryStorageProvider';
import type { Connection, ConnectionId, Hlc, Scope } from '../domain/types';
import { routeMarkerPath } from './remotePaths';
import {
  encodeRouteMarker,
  readRouteMarker,
  writeRouteMarker,
} from './routeMarkers';

const PROVIDER_ID = 'mem';
const SCOPE: Scope = 'profile:en';

const hlc = (wall: number, node = 'dev-1:ctx'): Hlc => ({ wall, counter: 0, node });

async function harness() {
  const provider = new InMemoryStorageProvider({ providerId: PROVIDER_ID });
  const account = await provider.authorize({ interactive: true });
  const connection: Connection = {
    connectionId: `${PROVIDER_ID}:${account.accountKey}` as ConnectionId,
    providerId: PROVIDER_ID,
    accountKey: account.accountKey,
    displayName: account.displayName,
  };
  return { provider, connection, fence: async () => undefined };
}

describe('writeRouteMarker', () => {
  it('writes a marker and verifies it landed', async () => {
    const t = await harness();
    const ok = await writeRouteMarker(t, SCOPE, {
      hlc: hlc(100),
      destination: 'local',
    });
    expect(ok).toBe(true);
    expect(await readRouteMarker(t.provider, t.connection, SCOPE)).toEqual({
      hlc: hlc(100),
      destination: 'local',
    });
  });

  it('refuses to overwrite a strictly newer existing marker', async () => {
    const t = await harness();
    await t.provider.write(t.connection, routeMarkerPath(SCOPE), encodeRouteMarker({
      hlc: hlc(200),
      destination: 'local',
    }));
    const ok = await writeRouteMarker(t, SCOPE, {
      hlc: hlc(100),
      destination: `${PROVIDER_ID}:other` as ConnectionId,
    });
    expect(ok).toBe(false);
    expect(await readRouteMarker(t.provider, t.connection, SCOPE)).toEqual({
      hlc: hlc(200),
      destination: 'local',
    });
  });

  it('returns false when a newer marker wins the write race', async () => {
    const t = await harness();
    const racing = Object.create(t.provider) as InMemoryStorageProvider;
    racing.write = async (conn, path, blob) => {
      const result = await t.provider.write(conn, path, blob);
      if (path === routeMarkerPath(SCOPE)) {
        await t.provider.write(conn, path, encodeRouteMarker({
          hlc: hlc(300),
          destination: 'local',
        }));
      }
      return result;
    };
    const ok = await writeRouteMarker(
      { provider: racing, connection: t.connection, fence: t.fence },
      SCOPE,
      { hlc: hlc(100), destination: 'local' },
    );
    expect(ok).toBe(false);
    expect((await readRouteMarker(t.provider, t.connection, SCOPE))?.hlc.wall).toBe(300);
  });
});
