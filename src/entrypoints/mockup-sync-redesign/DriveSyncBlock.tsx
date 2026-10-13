import { useState } from 'react';
import { Accordion } from '@/shared/ui/Accordion';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { SettingsGroup } from '@/shared/ui/SettingsGroup';
import { SettingsSection } from '@/shared/ui/SettingsSection';
import { StatusDot } from '@/shared/ui/StatusDot';
import { Text } from '@/shared/ui/Text';
import { Bars } from './Charts';
import { DRIVE_FIXTURES, timeAgo, type DriveState } from './mockData';

interface HeroMeta {
  readonly tone: 'ok' | 'info' | 'warn' | 'error' | 'neutral';
  readonly pulse: boolean;
  readonly title: string;
  readonly desc: string;
}

function heroFor(state: DriveState, lastSyncedAt: number | null): HeroMeta {
  const last = lastSyncedAt !== null ? ` Last synced ${timeAgo(lastSyncedAt)}.` : '';
  switch (state) {
    case 'connected':
      return {
        tone: 'ok',
        pulse: false,
        title: 'Protected',
        desc: `Your lists, dictionaries and settings are backed up.${last}`,
      };
    case 'syncing':
      return {
        tone: 'info',
        pulse: true,
        title: 'Syncing…',
        desc: 'Copying your latest changes to Google Drive. You can keep using the app.',
      };
    case 'reauth':
      return {
        tone: 'warn',
        pulse: false,
        title: 'Sign-in needed',
        desc: `Google asked us to check it's really you.${last} Sign in to keep syncing.`,
      };
    case 'offline':
      return {
        tone: 'neutral',
        pulse: false,
        title: 'Offline',
        desc: `Nothing to do — sync will resume on its own when you're back online.${last}`,
      };
    case 'full':
      return {
        tone: 'warn',
        pulse: false,
        title: 'Cloud storage full',
        desc: 'Google Drive ran out of space. Free up space on the connected account, then try again.',
      };
    case 'error':
      return {
        tone: 'error',
        pulse: false,
        title: "Couldn't load sync status",
        desc: 'Try again — if it keeps failing, reopen settings.',
      };
    default:
      return { tone: 'neutral', pulse: false, title: '', desc: '' };
  }
}

function heroAction(
  state: DriveState,
  busy: boolean,
  run: (via: DriveState, to: DriveState) => void,
): React.JSX.Element | null {
  switch (state) {
    case 'connected':
      return (
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Icon name="repeat" />}
          loading={busy}
          onClick={() => run('syncing', 'connected')}
        >
          Sync now
        </Button>
      );
    case 'reauth':
      return (
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Icon name="link" />}
          onClick={() => run('syncing', 'connected')}
        >
          Sign in
        </Button>
      );
    case 'offline':
      return (
        <Button variant="secondary" size="sm" leadingIcon={<Icon name="repeat" />} disabled>
          Sync now
        </Button>
      );
    case 'full':
      return (
        <Button variant="primary" size="sm" onClick={() => run('syncing', 'connected')}>
          Try again
        </Button>
      );
    case 'error':
      return (
        <Button variant="secondary" size="sm" onClick={() => run('syncing', 'connected')}>
          Try again
        </Button>
      );
    case 'syncing':
      return (
        <Button variant="secondary" size="sm" leadingIcon={<Icon name="repeat" />} loading>
          Sync now
        </Button>
      );
    default:
      return null;
  }
}

const SETUP_STEPS = [
  'Connect Google Drive',
  'We make a private copy',
  "You're protected",
] as const;

export function DriveSyncBlock({
  state,
  onStateChange,
}: {
  readonly state: DriveState;
  readonly onStateChange: (next: DriveState) => void;
}): React.JSX.Element {
  const fixture = DRIVE_FIXTURES[state];
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const busy = false;

  const run = (via: DriveState, to: DriveState): void => {
    onStateChange(via);
    window.setTimeout(() => onStateChange(to), 1600);
  };

  const hero = heroFor(state, fixture.lastSyncedAt);
  const activityTotal = fixture.activity.reduce((s, v) => s + v, 0);

  return (
    <SettingsSection
      title={
        <span className="msrSectionTitle">
          <Icon name="repeat" size="sm" color="secondary" />
          Cloud backup — Google Drive
        </span>
      }
      description="A private copy of your lists, dictionaries and settings lives in a 'Tihoka Sync' folder on your Google Drive. Only you can see it."
      data-section="cloud-backup"
    >
      {state === 'empty' && (
        <div className="msrSetup">
          <ol className="msrSteps" aria-label="Setup steps">
            {SETUP_STEPS.map((step, i) => (
              <li key={step} className={`msrStep ${i === 0 ? 'msrStep-current' : ''}`}>
                <span className="msrStepNum" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="msrStepLabel">{step}</span>
              </li>
            ))}
          </ol>
          <div className="msrSetupLead">
            <Text variant="label">Keep your learning safe</Text>
            <Text as="p" variant="supporting" color="secondary">
              Connect once — from then on Tihoka keeps a private copy on Google Drive for you.
            </Text>
          </div>
          <div>
            <Button
              variant="primary"
              leadingIcon={<Icon name="link" />}
              onClick={() => run('syncing', 'connected')}
            >
              Connect Google Drive
            </Button>
          </div>
        </div>
      )}

      {state !== 'empty' && (
        <>
          <div className={`msrHero msrHero-${hero.tone}`} role="status">
            <StatusDot
              status={hero.tone === 'ok' ? 'success' : hero.tone === 'warn' ? 'warning' : hero.tone === 'error' ? 'error' : hero.tone === 'info' ? 'info' : 'neutral'}
              pulse={hero.pulse}
              aria-label={hero.title}
              className="msrHeroDot"
            />
            <div className="msrHeroText">
              <span className="msrHeroTitle">{hero.title}</span>
              <span className="msrHeroDesc">{hero.desc}</span>
            </div>
            <div className="msrHeroAction">{heroAction(state, busy, run)}</div>
          </div>

          {state !== 'error' && fixture.activity.length > 0 && (
            <div className="msrChartCard">
              <div className="msrChartHead">
                <Text variant="label" color="secondary">
                  Backup activity — last 14 days
                </Text>
                <Text variant="supporting" color="secondary">
                  {activityTotal} items synced · 0 errors
                </Text>
              </div>
              <Bars values={fixture.activity} label={`${activityTotal} items synced over the last 14 days`} />
            </div>
          )}

          {state !== 'error' && fixture.accounts.length > 0 && (
            <SettingsGroup
              label="Connected accounts"
              action={
                <Button variant="link" size="sm" className="msrGroupAction">
                  <Icon name="plus" size="xs" /> Add account
                </Button>
              }
            >
              <ul className="msrList">
                {fixture.accounts.map((acc) => (
                  <li key={acc.id} className="msrAccountRow">
                    <Icon name="link" size="sm" color="secondary" className="msrAccountIcon" />
                    <div className="msrAccountText">
                      <Text variant="label" truncate>
                        {acc.name}
                      </Text>
                      <Text variant="supporting" color="secondary" as="span">
                        {acc.provider}
                      </Text>
                    </div>
                    {acc.isSystem && (
                      <Badge variant="secondary" size="sm">
                        System
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm">
                      Disconnect
                    </Button>
                  </li>
                ))}
              </ul>
            </SettingsGroup>
          )}

          {state !== 'error' && fixture.profiles.length > 0 && (
            <div className="msrFlat">
              <Accordion>
                <Accordion.Item value="advanced">
                  <Accordion.Trigger>
                    <span className="msrAdvTrigger">
                      Advanced
                      <Text as="span" variant="supporting" color="secondary">
                        Choose where each language profile syncs
                      </Text>
                    </span>
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <ul className="msrList">
                      {fixture.profiles.map((profile) => (
                        <li key={profile.id} className="msrAccountRow">
                          <div className="msrAccountText">
                            <Text variant="label">{profile.label}</Text>
                          </div>
                          <Select
                            size="sm"
                            variant="outline"
                            className="msrDestSelect"
                            value={destinations[profile.id] ?? profile.destination}
                            options={[
                              ...fixture.accounts.map((a) => ({ value: a.id, label: a.name })),
                              { value: 'local', label: 'Only on this device' },
                            ]}
                            onChange={(v) =>
                              setDestinations((prev) => ({ ...prev, [profile.id]: v }))
                            }
                            aria-label={`Sync destination for ${profile.label}`}
                          />
                        </li>
                      ))}
                    </ul>
                  </Accordion.Content>
                </Accordion.Item>
              </Accordion>
            </div>
          )}
        </>
      )}
    </SettingsSection>
  );
}
