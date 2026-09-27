import { useEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/shared/icons/Icon';
import {
  ACCOUNT_LABELS,
  accountLabel,
  type Binding,
  type MockProfile,
  type MockScenario,
} from './mockData';
import {
  accountAction,
  connectionStatus,
  profileAction,
  profileStatus,
  summaryStatus,
  type SyncMock,
} from './state';
import styles from './ConceptA.module.css';

function initialSelection(s: MockScenario): string | null {
  const moving = s.migration?.profileId;
  if (moving) return moving;
  const troubled = s.profiles.find(
    (p) => p.state === 'waiting' || p.state === 'local-storage-full',
  );
  if (troubled) return troubled.id;
  const bound = s.profiles.find((p) => {
    const c = s.connections.find((x) => x.id === p.binding);
    return c && c.state !== 'healthy';
  });
  return bound?.id ?? null;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function useDialogFocus(
  ref: RefObject<HTMLDivElement | null>,
  onClose: () => void,
  busy: boolean,
): void {
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const triggerRef = useRef<HTMLElement | null>(null);
  if (triggerRef.current === null) {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const trigger = triggerRef.current;
    const focusables = (): HTMLElement[] =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => !n.hasAttribute('disabled'),
      );
    const preferred = el.querySelector<HTMLElement>('[autofocus]');
    (preferred ?? focusables()[0] ?? el).focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (!busyRef.current) {
          e.stopPropagation();
          closeRef.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const idx = list.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && idx <= 0) {
        list[list.length - 1].focus();
        e.preventDefault();
      } else if (!e.shiftKey && (idx === -1 || idx === list.length - 1)) {
        list[0].focus();
        e.preventDefault();
      }
    };
    el.addEventListener('keydown', onKey);
    const stage = el.closest('.ms-stage');
    return () => {
      el.removeEventListener('keydown', onKey);
      const target =
        trigger?.isConnected
          ? trigger
          : stage?.querySelector<HTMLElement>('[data-dialog-restore]') ??
            stage?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    };
  }, [ref]);
}

function FocusDialog({
  labelledBy,
  className,
  busy = false,
  onClose,
  children,
}: {
  labelledBy: string;
  className: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose, busy);
  return (
    <div className={styles.overlay} role="presentation">
      <div
        ref={ref}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

function beaconHeadline(s: MockScenario, syncing: boolean): string {
  if (s.connections.length === 0) return 'Choose a safe home for your learning';
  if (syncing) return 'Syncing your learning';
  if (s.migration) return 'Moving a profile to safer ground';
  if (s.connections.some((c) => c.state === 'disconnect-pending')) {
    return 'Finishing a disconnect';
  }
  if (
    s.connections.some((c) => c.state !== 'healthy') ||
    s.profiles.some((p) => p.state === 'waiting' || p.state === 'local-storage-full')
  ) {
    return 'One thing needs attention';
  }
  return 'Your learning is protected';
}

export function ConceptA({ mock }: { mock: SyncMock }): ReactElement {
  const { scenario } = mock;
  const isFirstUse = scenario.connections.length === 0;
  const isEmpty = scenario.connections.length === 0 && scenario.profiles.length === 0;
  const otherConnected = scenario.connections.length > 1;
  const [selectedId, setSelectedId] = useState<string | null>(() => initialSelection(scenario));
  const summary = summaryStatus(scenario, mock.syncing);
  const selected = selectedId
    ? scenario.profiles.find((p) => p.id === selectedId)
    : undefined;
  const affected = mock.disconnectTarget
    ? scenario.profiles.filter((p) => p.binding === mock.disconnectTarget!.id)
    : [];
  const pendingProfile = mock.pendingRebind
    ? scenario.profiles.find((p) => p.id === mock.pendingRebind!.profileId)
    : undefined;
  const systemBusy =
    mock.pendingSystemAccount != null &&
    scenario.connections.find((c) => c.id === mock.pendingSystemAccount)?.state === 'syncing';

  const destinations: { id: Binding; label: string }[] = [
    ...scenario.connections.map((c) => ({ id: c.id as Binding, label: c.email })),
    { id: 'local', label: 'Only on this device' },
  ];

  return (
    <div className={styles.root}>
      <section className={styles.beacon} aria-label="Protection state">
        <div
          className={`${styles.ring}${isFirstUse ? ` ${styles.ringOpen}` : ''}${mock.syncing ? ` ${styles.pulse}` : ''}`}
          aria-hidden="true"
        >
          <span className={styles.ringCore}>
            <Icon name={summary.icon} size={28} />
          </span>
        </div>
        {isEmpty ? (
          <>
            <h2 className={styles.headline}>Create your first language profile</h2>
            <p className={styles.meta}>
              Each language you learn gets its own profile with dictionaries, study progress,
              and settings.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={mock.openProfileSettings}
            >
              <Icon name="plus" size={14} />
              Create language profile
            </button>
          </>
        ) : (
          <>
            <h2 className={styles.headline}>{beaconHeadline(scenario, mock.syncing)}</h2>
            {!isFirstUse && (
              <p className={styles.meta} role="status">
                {summary.label}
                {summary.tone === 'ok' && !mock.syncing && ` · Last synced ${scenario.lastSync}`}
              </p>
            )}
            {isFirstUse ? (
              <button type="button" className={styles.primaryBtn} onClick={mock.connect}>
                <span className={styles.gmark} aria-hidden="true">G</span>
                Connect Google Drive
              </button>
            ) : (
              <button
                type="button"
                className={styles.quietBtn}
                onClick={mock.syncNow}
                disabled={mock.syncing}
              >
                <Icon name="repeat" size={14} />
                {mock.syncing ? 'Syncing…' : 'Sync now'}
              </button>
            )}
          </>
        )}
      </section>

      {scenario.profiles.length > 0 && (
        <div className={styles.constellation} role="group" aria-label="Profiles">
          {scenario.profiles.map((p: MockProfile, i: number) => {
            const st = profileStatus(p, scenario.connections);
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.marker} ${styles[`pos${i}`] ?? ''}${selected?.id === p.id ? ` ${styles.markerOn}` : ''}`}
                aria-pressed={selected?.id === p.id}
                onClick={() => setSelectedId(p.id)}
              >
                <span className={`${styles.dot} ${styles[`tone-${st.tone}`]}`} aria-hidden="true">
                  <Icon name={st.icon} size={12} />
                </span>
                <span className={styles.markerLang}>{p.language}</span>
                <span className={styles.markerState}>{st.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && !isFirstUse && (
        <section className={styles.inspector} aria-label={`${selected.language} details`}>
          <h3 className={styles.inspectorTitle}>{selected.language}</h3>
          {scenario.migration?.profileId === selected.id ? (
            <div className={styles.signal} role="status">
              <progress
                value={scenario.migration.progress}
                max={100}
                aria-label={`Moving ${selected.language}`}
              />
              <span>
                Copying to {accountLabel(scenario.migration.to, scenario.connections)} —{' '}
                {scenario.migration.progress}%. Old cloud copy is untouched.
              </span>
            </div>
          ) : (
            <div className={styles.destGroup} role="group" aria-label={`Destination for ${selected.language}`}>
              {destinations.map((d) => {
                const checked = selected.binding === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={checked}
                    className={`${styles.dest}${checked ? ` ${styles.destOn}` : ''}`}
                    disabled={selected.state === 'waiting' || !!mock.pendingRebind}
                    onClick={() => mock.requestRebind(selected.id, d.id)}
                  >
                    <span className={styles.destDot} aria-hidden="true" />
                    {d.label}
                  </button>
                );
              })}
            </div>
          )}
          {(() => {
            const pAction = profileAction(selected, mock);
            const bound = scenario.connections.find((c) => c.id === selected.binding);
            const aAction = bound ? accountAction(bound, mock) : null;
            const action = pAction ?? (bound && selected.state === 'waiting' ? aAction : null);
            return action ? (
              <button type="button" className={styles.primaryBtn} onClick={action.run}>
                {action.label}
              </button>
            ) : null;
          })()}
          {mock.completedRebind?.profileId === selected.id && (
            <div className={styles.echo} role="group" aria-label={`Old copy for ${selected.language}`}>
              <span className={styles.echoRing} aria-hidden="true" />
              <span>
                {selected.language} is now stored in{' '}
                {accountLabel(mock.completedRebind.to, scenario.connections)}. Keep the old
                cloud copy?
              </span>
              <span className={styles.echoActions}>
                <button type="button" className={styles.primaryBtn} onClick={mock.keepOldCopy} autoFocus>
                  Keep old copy
                </button>
                <button type="button" className={styles.dangerBtn} onClick={mock.deleteOldCopy}>
                  Delete old copy
                </button>
              </span>
            </div>
          )}
        </section>
      )}

      {!isFirstUse && (
        <details className={styles.protection}>
          <summary>Manage protection</summary>
          <div className={styles.bands}>
            {scenario.connections.map((c) => {
              const st = connectionStatus(c);
              const action = accountAction(c, mock);
              const disconnectBlocked =
                (c.system && otherConnected) || !!mock.pendingSystemAccount;
              return (
                <div key={c.id} className={styles.band}>
                  <span className={styles.bandName}>
                    {c.email}
                    {c.system && <em className={styles.sysMark}>System storage</em>}
                  </span>
                  <span className={`${styles.bandState} ${styles[`tone-${st.tone}`]}`}>
                    <Icon name={st.icon} size={14} />
                    {st.label}
                  </span>
                  <span className={styles.bandActions}>
                    {action && (
                      <button type="button" className={styles.textBtn} onClick={action.run}>
                        {action.label}
                      </button>
                    )}
                    {!c.system && (
                      <button
                        type="button"
                        className={styles.textBtn}
                        onClick={() => mock.requestSystemChange(c.id)}
                      >
                        Make system storage
                      </button>
                    )}
                    {disconnectBlocked ? (
                      <span className={styles.blocked}>Choose another system storage first</span>
                    ) : (
                      <button
                        type="button"
                        className={`${styles.textBtn} ${styles.dangerText}`}
                        onClick={() => mock.requestDisconnect(c.id)}
                      >
                        Disconnect…
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
            {scenario.connections.length === 1 && (
              <button type="button" className={styles.textBtn} onClick={mock.connectAnother}>
                Connect another account
              </button>
            )}
          </div>
        </details>
      )}

      {mock.notice && (
        <p className={styles.notice} role="status" aria-live="polite">
          {mock.notice}
        </p>
      )}

      <details className={styles.privacy}>
        <summary>What gets synced</summary>
        <p>
          Sync covers your language profiles, dictionaries, study progress, Reader books,
          settings, and subtitle API keys. Your data stays in your app data folder and is only
          copied to the storage account you choose — keeping the old cloud copy is always the
          default.
        </p>
      </details>

      {mock.pendingRebind && pendingProfile && (
        <FocusDialog labelledBy="a-rd" className={styles.ringDialog} onClose={mock.cancelRebind}>
            <span className={styles.dialogRing} aria-hidden="true" />
            {mock.pendingRebind.from === 'local' ? (
              <>
                <h3 id="a-rd" className={styles.dialogTitle}>
                  Start syncing {pendingProfile.language} to{' '}
                  {accountLabel(mock.pendingRebind.to, scenario.connections)}?
                </h3>
                <p className={styles.dialogBody}>
                  Cell uploads and verifies this profile before showing it as protected.
                </p>
              </>
            ) : (
              <>
                <h3 id="a-rd" className={styles.dialogTitle}>
                  Move {pendingProfile.language} to{' '}
                  {accountLabel(mock.pendingRebind.to, scenario.connections)}?
                </h3>
                <p className={styles.dialogBody}>
                  Cell copies and verifies this profile before changing its destination. The
                  current cloud copy stays untouched.
                </p>
              </>
            )}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.textBtn} onClick={mock.cancelRebind} autoFocus>
                Cancel
              </button>
              <button type="button" className={styles.primaryBtn} onClick={mock.confirmRebind}>
                Copy and move
              </button>
            </div>
        </FocusDialog>
      )}

      {mock.pendingSystemAccount && (
        <FocusDialog
          labelledBy="a-sd"
          className={styles.ringDialog}
          busy={!!systemBusy}
          onClose={mock.cancelSystemChange}
        >
            <span className={styles.dialogRing} aria-hidden="true" />
            <h3 id="a-sd" className={styles.dialogTitle}>
              Use {ACCOUNT_LABELS[mock.pendingSystemAccount]} for system storage?
            </h3>
            {systemBusy ? (
              <p className={styles.dialogBody} role="status">Copying shared settings…</p>
            ) : (
              <p className={styles.dialogBody}>
                Cell copies and verifies shared settings before switching system storage.
                Profile destinations stay unchanged.
              </p>
            )}
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.textBtn}
                onClick={mock.cancelSystemChange}
                disabled={systemBusy}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={mock.confirmSystemChange}
                disabled={systemBusy}
              >
                Copy and switch
              </button>
            </div>
        </FocusDialog>
      )}

      {mock.disconnectTarget && (
        <FocusDialog labelledBy="a-dd" className={styles.ringDialog} onClose={mock.cancelDisconnect}>
            <span className={styles.dialogRing} aria-hidden="true" />
            <h3 id="a-dd" className={styles.dialogTitle}>
              Disconnect {mock.disconnectTarget.email}?
            </h3>
            <p className={styles.dialogBody}>
              Sync for {affected.length} {affected.length === 1 ? 'profile' : 'profiles'} will
              pause: {affected.map((p) => p.language).join(', ') || 'none'}.
            </p>
            <p className={styles.dialogBody}>
              Local data stays intact and your cloud copy is kept.
            </p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.textBtn} onClick={mock.cancelDisconnect} autoFocus>
                Cancel
              </button>
              <button type="button" className={styles.dangerBtn} onClick={mock.confirmDisconnect}>
                Disconnect
              </button>
            </div>
        </FocusDialog>
      )}
    </div>
  );
}
