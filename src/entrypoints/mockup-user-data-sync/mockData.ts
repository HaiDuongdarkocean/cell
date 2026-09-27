export type ScenarioId =
  | 'first-use'
  | 'protected'
  | 'attention'
  | 'migrating'
  | 'disconnect-pending'
  | 'offline'
  | 'cloud-full'
  | 'waiting-account'
  | 'device-full'
  | 'empty'
  | 'overflow';

export type ConnectionState =
  | 'healthy'
  | 'needs-reauth'
  | 'syncing'
  | 'disconnect-pending'
  | 'offline'
  | 'storage-full'
  | 'waiting-connection';

export type Binding =
  | 'google-drive:duong'
  | 'google-drive:study'
  | 'google-drive:work'
  | 'google-drive:archive'
  | 'google-drive:family'
  | 'google-drive:long'
  | 'local';

export type AccountId = Exclude<Binding, 'local'>;

export type ProfileState =
  | 'protected'
  | 'waiting'
  | 'migrating'
  | 'local'
  | 'local-storage-full';

export interface MockConnection {
  id: AccountId;
  email: string;
  state: ConnectionState;
  system: boolean;
  lastSync: string;
}

export interface MockProfile {
  id: string;
  language: string;
  binding: Binding;
  state: ProfileState;
}

export interface MockMigration {
  profileId: string;
  from: AccountId;
  to: AccountId;
  progress: number;
}

export interface MockScenario {
  lastSync: string;
  connections: MockConnection[];
  profiles: MockProfile[];
  migration: MockMigration | null;
}

export const ACCOUNT_LABELS: Record<AccountId, string> = {
  'google-drive:duong': 'duong@example.com',
  'google-drive:study': 'study@example.com',
  'google-drive:work': 'language-team@international-company.example',
  'google-drive:archive': 'learning-archive@example-university.edu',
  'google-drive:family': 'family.learning.account@example.com',
  'google-drive:long': 'language-learning-archive-with-a-very-long-name@example-university.edu',
};

const baseConnections = (): MockConnection[] => [
  {
    id: 'google-drive:duong',
    email: 'duong@example.com',
    state: 'healthy',
    system: true,
    lastSync: '2 minutes ago',
  },
  {
    id: 'google-drive:study',
    email: 'study@example.com',
    state: 'healthy',
    system: false,
    lastSync: '2 minutes ago',
  },
];

const baseProfiles = (): MockProfile[] => [
  { id: 'en', language: 'English', binding: 'google-drive:duong', state: 'protected' },
  { id: 'ja', language: 'Japanese', binding: 'google-drive:duong', state: 'protected' },
  { id: 'ko', language: 'Korean', binding: 'google-drive:study', state: 'protected' },
];

const localProfiles = (): MockProfile[] => [
  { id: 'en', language: 'English', binding: 'local', state: 'local' },
  { id: 'ja', language: 'Japanese', binding: 'local', state: 'local' },
  { id: 'ko', language: 'Korean', binding: 'local', state: 'local' },
];

const protectedBase = (): MockScenario => ({
  lastSync: '2 minutes ago',
  connections: baseConnections(),
  profiles: baseProfiles(),
  migration: null,
});

export function buildScenario(id: ScenarioId): MockScenario {
  switch (id) {
    case 'first-use':
      return { lastSync: '', connections: [], profiles: localProfiles(), migration: null };
    case 'attention': {
      const s = protectedBase();
      s.connections[1].state = 'needs-reauth';
      s.connections[1].lastSync = '3 days ago';
      s.profiles[2].state = 'waiting';
      return s;
    }
    case 'migrating': {
      const s = protectedBase();
      s.profiles[0].state = 'migrating';
      s.migration = {
        profileId: 'en',
        from: 'google-drive:duong',
        to: 'google-drive:study',
        progress: 62,
      };
      return s;
    }
    case 'disconnect-pending': {
      const s = protectedBase();
      s.connections[1].state = 'disconnect-pending';
      return s;
    }
    case 'offline': {
      const s = protectedBase();
      s.connections[1].state = 'offline';
      s.connections[1].lastSync = 'yesterday';
      return s;
    }
    case 'cloud-full': {
      const s = protectedBase();
      s.connections[1].state = 'storage-full';
      s.connections[1].lastSync = '2 days ago';
      return s;
    }
    case 'waiting-account': {
      const s = protectedBase();
      s.connections[1].state = 'waiting-connection';
      s.profiles[2].state = 'waiting';
      return s;
    }
    case 'device-full': {
      const s = protectedBase();
      s.profiles[2].state = 'local-storage-full';
      return s;
    }
    case 'empty':
      return { lastSync: '', connections: [], profiles: [], migration: null };
    case 'overflow':
      return {
        lastSync: '4 minutes ago',
        connections: [
          {
            id: 'google-drive:duong',
            email: ACCOUNT_LABELS['google-drive:duong'],
            state: 'healthy',
            system: true,
            lastSync: '4 minutes ago',
          },
          {
            id: 'google-drive:study',
            email: ACCOUNT_LABELS['google-drive:study'],
            state: 'healthy',
            system: false,
            lastSync: '4 minutes ago',
          },
          {
            id: 'google-drive:work',
            email: ACCOUNT_LABELS['google-drive:work'],
            state: 'offline',
            system: false,
            lastSync: 'yesterday',
          },
          {
            id: 'google-drive:archive',
            email: ACCOUNT_LABELS['google-drive:archive'],
            state: 'storage-full',
            system: false,
            lastSync: '2 days ago',
          },
          {
            id: 'google-drive:family',
            email: ACCOUNT_LABELS['google-drive:family'],
            state: 'healthy',
            system: false,
            lastSync: '4 minutes ago',
          },
          {
            id: 'google-drive:long',
            email: ACCOUNT_LABELS['google-drive:long'],
            state: 'healthy',
            system: false,
            lastSync: '4 minutes ago',
          },
        ],
        profiles: [
          { id: 'en', language: 'English', binding: 'google-drive:duong', state: 'protected' },
          { id: 'ja', language: 'Japanese', binding: 'google-drive:duong', state: 'protected' },
          { id: 'ko', language: 'Korean', binding: 'google-drive:study', state: 'protected' },
          {
            id: 'pt',
            language: 'Portuguese (Brazil)',
            binding: 'google-drive:work',
            state: 'protected',
          },
          { id: 'es', language: 'Spanish', binding: 'google-drive:archive', state: 'protected' },
          { id: 'fr', language: 'French', binding: 'google-drive:family', state: 'protected' },
          { id: 'de', language: 'German', binding: 'google-drive:long', state: 'protected' },
          { id: 'ar', language: 'Arabic', binding: 'local', state: 'local' },
          { id: 'it', language: 'Italian', binding: 'google-drive:work', state: 'protected' },
          { id: 'nl', language: 'Dutch', binding: 'google-drive:archive', state: 'protected' },
          { id: 'tr', language: 'Turkish', binding: 'google-drive:family', state: 'protected' },
          { id: 'id', language: 'Indonesian', binding: 'google-drive:long', state: 'protected' },
        ],
        migration: null,
      };
    case 'protected':
    default:
      return protectedBase();
  }
}

export function accountLabel(binding: Binding, connections: MockConnection[]): string {
  if (binding === 'local') return 'Only on this device';
  const account = connections.find((c) => c.id === binding);
  return account ? account.email : binding;
}
