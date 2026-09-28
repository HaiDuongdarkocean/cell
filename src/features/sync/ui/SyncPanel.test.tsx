import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SyncPanel } from './SyncPanel';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { LanguageProfile, Settings } from '@/entities/settings';
import type { ConnectionId, Scope } from '../domain/types';
import type { SyncStatusView } from '../app/syncService';
import * as client from './syncClient';

jest.mock('./syncClient', () => ({
  getSyncStatus: jest.fn(),
  syncNow: jest.fn(),
  connectProviderAccount: jest.fn(),
  disconnectConnection: jest.fn(),
  disconnectConnectionLocally: jest.fn(),
  setSystemConnection: jest.fn(),
  setScopeBinding: jest.fn(),
  onSyncStatusChanged: jest.fn(() => () => undefined),
}));

const mocked = client as jest.Mocked<typeof client>;

const CONN_A = 'google-drive:acct-a' as ConnectionId;
const CONN_B = 'google-drive:acct-b' as ConnectionId;

function makeProfile(id: string, target: string, order: number): LanguageProfile {
  return {
    id,
    target,
    native: '',
    name: `Profile ${id}`,
    order,
    subtitleOverlayTargetStyle: DEFAULT_SETTINGS.subtitleOverlayTargetStyle!,
    subtitleOverlayNativeStyle: DEFAULT_SETTINGS.subtitleOverlayNativeStyle!,
    subtitleOverlayAutoLoad: true,
    subtitleOverlayAutoLoadAsr: false,
    subtitleOverlayAutoTranslate: false,
    dictionaryPopup: DEFAULT_SETTINGS.dictionaryPopup!,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    languageProfiles: [makeProfile('p1', 'en', 1), makeProfile('p2', 'ja', 2)],
    activeProfileId: 'p1',
    ...overrides,
  } as Settings;
}

function makeView(overrides: Partial<SyncStatusView> = {}): SyncStatusView {
  return {
    engine: { state: 'idle', updatedAt: 1 },
    directory: {
      connections: [
        {
          connectionId: CONN_A,
          providerId: 'google-drive',
          displayName: 'a@example.com',
          isSystem: true,
          disconnectPending: false,
          state: 'connected',
          hasToken: true,
        },
      ],
      bindings: [
        {
          target: 'en',
          scope: 'profile:en' as Scope,
          destination: CONN_A,
          frozen: false,
          waiting: false,
          waitingFor: null,
          vacatedFrom: null,
        },
        {
          target: 'ja',
          scope: 'profile:ja' as Scope,
          destination: 'local',
          frozen: false,
          waiting: false,
          waitingFor: null,
          vacatedFrom: null,
        },
      ],
      systemConnection: CONN_A,
      lastAppliedAt: 1700000000000,
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getSyncStatus.mockResolvedValue(makeView());
  mocked.onSyncStatusChanged.mockReturnValue(() => undefined);
});

describe('SyncPanel', () => {
  it('shows the branded connect action in the empty state', async () => {
    mocked.getSyncStatus.mockResolvedValue(
      makeView({
        directory: { connections: [], bindings: [], systemConnection: null, lastAppliedAt: null },
      }),
    );
    render(<SyncPanel settings={makeSettings()} />);
    const connect = await screen.findByRole('button', { name: /connect google drive/i });
    mocked.connectProviderAccount.mockResolvedValue({} as never);
    fireEvent.click(connect);
    await waitFor(() =>
      expect(mocked.connectProviderAccount).toHaveBeenCalledWith('google-drive'),
    );
  });

  it('renders accounts with the system badge and last sync time', async () => {
    render(<SyncPanel settings={makeSettings()} />);
    expect((await screen.findAllByText('a@example.com')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('System').length).toBeGreaterThan(0);
    expect(screen.getByText(/last synced/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
  });

  it('runs a cycle when Sync now is pressed', async () => {
    mocked.syncNow.mockResolvedValue({} as never);
    render(<SyncPanel settings={makeSettings()} />);
    fireEvent.click(await screen.findByRole('button', { name: /sync now/i }));
    await waitFor(() => expect(mocked.syncNow).toHaveBeenCalled());
  });

  it('rebinds a profile via the destination select', async () => {
    mocked.setScopeBinding.mockResolvedValue(null);
    render(<SyncPanel settings={makeSettings()} />);
    await screen.findAllByText('a@example.com');
    const select = screen.getByRole('button', { name: /sync destination for english/i });
    fireEvent.click(select);
    fireEvent.click(await screen.findByRole('option', { name: /only on this device/i }));
    await waitFor(() =>
      expect(mocked.setScopeBinding).toHaveBeenCalledWith('profile:en', 'local'),
    );
  });

  it('disables destination select while a rebind copies data', async () => {
    mocked.getSyncStatus.mockResolvedValue(
      makeView({
        directory: {
          connections: [
            {
              connectionId: CONN_A,
              providerId: 'google-drive',
              displayName: 'a@example.com',
              isSystem: true,
              disconnectPending: false,
              state: 'connected',
              hasToken: true,
            },
          ],
          bindings: [
            {
              target: 'en',
              scope: 'profile:en' as Scope,
              destination: CONN_A,
              frozen: true,
              waiting: false,
              waitingFor: null,
              vacatedFrom: null,
            },
          ],
          systemConnection: CONN_A,
          lastAppliedAt: null,
        },
      }),
    );
    render(<SyncPanel settings={makeSettings()} />);
    const select = await screen.findByRole('button', {
      name: /sync destination for english/i,
    });
    expect(select).toBeDisabled();
    expect(screen.getByText(/copying data before switching/i)).toBeInTheDocument();
  });

  it('opens a disconnect dialog previewing affected profiles', async () => {
    render(<SyncPanel settings={makeSettings()} />);
    fireEvent.click(
      await screen.findByRole('button', { name: /^disconnect$/i }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/profiles syncing to this account/i)).toBeInTheDocument();
    mocked.disconnectConnection.mockResolvedValue({} as never);
    fireEvent.click(
      within(dialog).getByRole('button', { name: /^disconnect$/i }),
    );
    await waitFor(() =>
      expect(mocked.disconnectConnection).toHaveBeenCalledWith(CONN_A),
    );
  });

  it('offers local removal on unreachable accounts and confirms before removing', async () => {
    mocked.getSyncStatus.mockResolvedValue(
      makeView({
        directory: {
          connections: [
            {
              connectionId: CONN_A,
              providerId: 'google-drive',
              displayName: 'a@example.com',
              isSystem: true,
              disconnectPending: false,
              state: 'connected',
              hasToken: true,
            },
            {
              connectionId: CONN_B,
              providerId: 'google-drive',
              displayName: 'b@example.com',
              isSystem: false,
              disconnectPending: true,
              state: 'disconnect-pending',
              hasToken: false,
            },
          ],
          bindings: [],
          systemConnection: CONN_A,
          lastAppliedAt: null,
        },
      }),
    );
    render(<SyncPanel settings={makeSettings()} />);
    fireEvent.click(
      await screen.findByRole('button', { name: /remove locally/i }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      screen.getByText(/remove account on this device/i),
    ).toBeInTheDocument();
    mocked.disconnectConnectionLocally.mockResolvedValue({} as never);
    fireEvent.click(
      within(dialog).getByRole('button', { name: /remove locally/i }),
    );
    await waitFor(() =>
      expect(mocked.disconnectConnectionLocally).toHaveBeenCalledWith(CONN_B),
    );
    expect(mocked.disconnectConnection).not.toHaveBeenCalled();
  });

  it('labels bindings waiting on a missing connection', async () => {
    mocked.getSyncStatus.mockResolvedValue(
      makeView({
        directory: {
          connections: [
            {
              connectionId: CONN_A,
              providerId: 'google-drive',
              displayName: 'a@example.com',
              isSystem: true,
              disconnectPending: false,
              state: 'connected',
              hasToken: true,
            },
          ],
          bindings: [
            {
              target: 'en',
              scope: 'profile:en' as Scope,
              destination: CONN_B,
              frozen: false,
              waiting: true,
              waitingFor: CONN_B,
              vacatedFrom: null,
            },
          ],
          systemConnection: CONN_A,
          lastAppliedAt: null,
        },
      }),
    );
    render(<SyncPanel settings={makeSettings()} />);
    expect(await screen.findByText(/waiting for/i)).toBeInTheDocument();
  });

  it('shows the offline state without a destructive action', async () => {
    mocked.getSyncStatus.mockResolvedValue(
      makeView({ engine: { state: 'offline', updatedAt: 1 } }),
    );
    render(<SyncPanel settings={makeSettings()} />);
    expect((await screen.findAllByText('Offline')).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/resume automatically when you're back online/i),
    ).toBeInTheDocument();
  });
});
