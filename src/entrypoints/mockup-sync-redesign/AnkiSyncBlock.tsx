import { useEffect, useState } from 'react';
import { Accordion } from '@/shared/ui/Accordion';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { InputField } from '@/shared/ui/InputField';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { SettingsSection } from '@/shared/ui/SettingsSection';
import { StatusDot } from '@/shared/ui/StatusDot';
import { Text } from '@/shared/ui/Text';
import { Toggle } from '@/shared/ui/Toggle';
import { Donut, Sparkline } from './Charts';
import { ANKI_FIXTURES, timeAgo, type AnkiState } from './mockData';

type HeroTone = 'ok' | 'info' | 'warn' | 'error' | 'neutral';

interface HeroMeta {
  readonly tone: HeroTone;
  readonly pulse: boolean;
  readonly title: string;
  readonly desc: string;
}

function heroFor(state: AnkiState, changed: number, errors: number, lastSyncAt: number | null): HeroMeta {
  const last = lastSyncAt !== null ? timeAgo(lastSyncAt) : null;
  switch (state) {
    case 'off':
      return {
        tone: 'neutral',
        pulse: false,
        title: 'Anki sync is off',
        desc: 'Turn it on to keep word statuses in step with Anki.',
      };
    case 'never':
      return {
        tone: 'info',
        pulse: false,
        title: 'Ready to sync',
        desc: 'Nothing synced yet. Open Anki, then press Sync now — the first run matches your cards to your words.',
      };
    case 'idle':
      return {
        tone: 'ok',
        pulse: false,
        title: 'Up to date',
        desc: `Last run ${last}: ${changed} words updated, ${errors} errors.`,
      };
    case 'syncing':
      return {
        tone: 'info',
        pulse: true,
        title: 'Syncing…',
        desc: 'Checking cards in Anki — 640 of 1,240 done. You can keep studying.',
      };
    case 'error':
      return {
        tone: 'error',
        pulse: false,
        title: 'Sync failed',
        desc: `Couldn't reach Anki (3 tries in a row). Open Anki and check the Tihoka Bridge add-on, then try again.`,
      };
    default:
      return { tone: 'neutral', pulse: false, title: '', desc: '' };
  }
}

export function AnkiSyncBlock({
  state,
  onStateChange,
}: {
  readonly state: AnkiState;
  readonly onStateChange: (next: AnkiState) => void;
}): React.JSX.Element {
  const fixture = ANKI_FIXTURES[state];
  const [enabled, setEnabled] = useState(fixture.enabled);
  const [writeBack, setWriteBack] = useState(true);
  const [port, setPort] = useState('8766');

  useEffect(() => {
    setEnabled(fixture.enabled);
  }, [fixture.enabled, state]);

  const run = (via: AnkiState, to: AnkiState): void => {
    onStateChange(via);
    window.setTimeout(() => onStateChange(to), 1800);
  };

  const hero = heroFor(state, fixture.changed, fixture.errors, fixture.lastSyncAt);
  const hasStats = fixture.lastSyncAt !== null && fixture.changesPerSync.length > 0;
  const unchanged = Math.max(fixture.cardsSeen - fixture.changed - fixture.errors, 0);
  const totalChanges = fixture.changesPerSync.reduce((s, v) => s + v, 0);
  const totalErrors = fixture.errorsPerSync.reduce((s, v) => s + v, 0);

  const addon =
    fixture.addonOnline === true
      ? { tone: 'ok' as HeroTone, label: 'Tihoka Bridge add-on connected' }
      : fixture.addonOnline === false
        ? { tone: 'warn' as HeroTone, label: 'Tihoka Bridge add-on not detected — using slower polling' }
        : { tone: 'neutral' as HeroTone, label: 'Tihoka Bridge add-on — status unknown' };

  const heroAction = (() => {
    if (state === 'off') {
      return (
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Icon name="power" />}
          onClick={() => {
            setEnabled(true);
            onStateChange('never');
          }}
        >
          Turn on sync
        </Button>
      );
    }
    if (state === 'error') {
      return (
        <Button variant="primary" size="sm" onClick={() => run('syncing', 'idle')}>
          Try again
        </Button>
      );
    }
    return (
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Icon name="repeat" />}
        loading={state === 'syncing'}
        onClick={() => run('syncing', 'idle')}
      >
        Sync now
      </Button>
    );
  })();

  return (
    <SettingsSection
      title={
        <span className="msrSectionTitle">
          <Icon name="windowPage" size="sm" color="secondary" />
          Anki sync
        </span>
      }
      description="Keeps word statuses (tracking, known) in step between Tihoka, Tihoka SRS and your Anki deck."
      data-section="anki-sync"
    >
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
          {state === 'syncing' && (
            <span className="msrProgress" aria-hidden="true">
              <span className="msrProgressFill" style={{ width: '52%' }} />
            </span>
          )}
        </div>
        <div className="msrHeroAction">{heroAction}</div>
      </div>

      {state !== 'off' && (
        <div className="msrBridgeRow">
          <StatusDot
            size="sm"
            status={addon.tone === 'ok' ? 'success' : addon.tone === 'warn' ? 'warning' : 'neutral'}
            aria-label={addon.label}
          />
          <Text variant="supporting" color="secondary" as="span">
            {addon.label}
          </Text>
          {fixture.lastSyncAt !== null && (
            <Text variant="supporting" color="secondary" as="span" className="msrBridgeMeta">
              Last synced {timeAgo(fixture.lastSyncAt)}
            </Text>
          )}
        </div>
      )}

      {hasStats && (
        <div className="msrChartCard">
          <div className="msrChartHead">
            <Text variant="label" color="secondary">
              Last sync {state === 'syncing' ? 'in progress' : `· ${timeAgo(fixture.lastSyncAt ?? 0)}`}
            </Text>
            <Text variant="supporting" color="secondary">
              {totalChanges} changes over last 14 runs{totalErrors > 0 ? ` · ${totalErrors} errors` : ''}
            </Text>
          </div>
          <div className="msrStatGrid">
            <div className="msrStatTihoka">
              <Donut
                caption="cards"
                center={fixture.cardsSeen.toLocaleString('en')}
                segments={[
                  { value: unchanged, tone: 'muted', label: 'Unchanged' },
                  { value: fixture.changed, tone: 'primary', label: 'Updated' },
                  { value: fixture.errors, tone: 'error', label: 'Errors' },
                ]}
              />
              <div className="msrLegend">
                <span className="msrLegendItem">
                  <i className="msrLegendKey msrLegendKey-primary" /> {fixture.changed} updated
                </span>
                <span className="msrLegendItem">
                  <i className="msrLegendKey msrLegendKey-error" /> {fixture.errors} errors
                </span>
                <span className="msrLegendItem">
                  <i className="msrLegendKey msrLegendKey-muted" /> {unchanged.toLocaleString('en')} unchanged
                </span>
              </div>
            </div>
            <div className="msrStatTihoka">
              <div className="msrChartHead">
                <Text variant="supporting" color="secondary">
                  Words updated per sync — last 14 runs
                </Text>
              </div>
              <Sparkline
                values={fixture.changesPerSync}
                label={`${totalChanges} words updated over the last 14 syncs`}
              />
              {totalErrors > 0 && (
                <Sparkline
                  values={fixture.errorsPerSync}
                  tone="error"
                  label={`${totalErrors} errors over the last 14 syncs`}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {!hasStats && state !== 'off' && (
        <div className="msrChartCard msrChartEmpty">
          <Text variant="supporting" color="secondary">
            Charts appear here after your first sync — what changed, what matched, what failed.
          </Text>
        </div>
      )}

      <div className="msrFlat">
        <Accordion>
          <Accordion.Item value="advanced">
            <Accordion.Trigger>
              <span className="msrAdvTrigger">
                Setup &amp; advanced
                <Text as="span" variant="supporting" color="secondary">
                  {enabled ? 'Sync is on · port ' + port : 'Turn sync on, write-back, bridge port'}
                </Text>
              </span>
            </Accordion.Trigger>
            <Accordion.Content>
              <SettingsRow
                dense
                title="Sync word status"
                description="Keeps word statuses (tracking/known) in step with Anki."
              >
                <Toggle
                  checked={enabled}
                  onChange={(next) => {
                    setEnabled(next);
                    if (!next) onStateChange('off');
                    else if (state === 'off') onStateChange('never');
                  }}
                  ariaLabel="Sync word status"
                />
              </SettingsRow>
              <SettingsRow
                dense
                title="Write back to Anki"
                description="Known words mature their Anki cards (21+ days)."
              >
                <Toggle
                  checked={writeBack}
                  disabled={!enabled}
                  onChange={setWriteBack}
                  ariaLabel="Write back to Anki"
                />
              </SettingsRow>
              <SettingsRow dense stacked>
                <InputField
                  label="Bridge add-on port"
                  type="number"
                  min={1}
                  max={65535}
                  inputMode="numeric"
                  value={port}
                  disabled={!enabled}
                  helperText="Port the Tihoka Bridge add-on serves events on (default 8766)."
                  onChange={(e) => setPort(e.target.value)}
                />
              </SettingsRow>
              {fixture.addonOnline === false && (
                <Text as="p" variant="supporting" color="secondary" className="msrFallback">
                  Add-on not installed — polling instead. Install Tihoka Bridge in Anki for faster
                  updates.
                </Text>
              )}
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </div>
    </SettingsSection>
  );
}
