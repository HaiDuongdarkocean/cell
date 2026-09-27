import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { Icon } from '@/shared/icons/Icon';
import {
  ACCOUNT_LABELS,
  accountLabel,
  type Binding,
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
import styles from './ConceptB.module.css';

type Tray = { kind: 'profile' | 'account'; id: string } | null;

interface Channel {
  x: number;
  y: number;
  w: number;
  a: number;
}

function initialTray(s: MockScenario): Tray {
  if (s.migration) return { kind: 'profile', id: s.migration.profileId };
  const troubled = s.profiles.find(
    (p) => p.state === 'waiting' || p.state === 'local-storage-full',
  );
  if (troubled) return { kind: 'profile', id: troubled.id };
  const badAccount = s.connections.find((c) => c.state !== 'healthy');
  if (badAccount) return { kind: 'account', id: badAccount.id };
  return null;
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
    <div className={styles.veil} role="presentation">
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

export function ConceptB({ mock }: { mock: SyncMock }): ReactElement {
  const { scenario } = mock;
  const isFirstUse = scenario.connections.length === 0;
  const isEmpty = scenario.connections.length === 0 && scenario.profiles.length === 0;
  const otherConnected = scenario.connections.length > 1;
  const summary = summaryStatus(scenario, mock.syncing);
  const [tray, setTray] = useState<Tray>(() => initialTray(scenario));
  const mapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLElement | null>>({});
  const [channels, setChannels] = useState<Record<string, Channel>>({});

  const reservoirs: { id: Binding; label: string; accountId?: string }[] = [
    ...scenario.connections.map((c) => ({ id: c.id as Binding, label: c.email, accountId: c.id })),
    { id: 'local', label: 'This device' },
  ];

  const selectedProfile = tray?.kind === 'profile'
    ? scenario.profiles.find((p) => p.id === tray.id)
    : undefined;
  const trayAccount = tray?.kind === 'account'
    ? scenario.connections.find((c) => c.id === tray.id)
    : undefined;

  const channelTarget = (binding: Binding, profileId: string): Binding => {
    if (scenario.migration?.profileId === profileId) return scenario.migration.to;
    return binding;
  };

  useLayoutEffect(() => {
    const measure = (): void => {
      const map = mapRef.current;
      if (!map) return;
      const rect = map.getBoundingClientRect();
      const mid = (el: HTMLElement): { x: number; y: number } => {
        const r = el.getBoundingClientRect();
        return { x: r.left - rect.left + r.width / 2, y: r.top - rect.top + r.height / 2 };
      };
      const next: Record<string, Channel> = {};
      for (const p of scenario.profiles) {
        const s = nodeRefs.current[`src-${p.id}`];
        const d = nodeRefs.current[`dst-${channelTarget(p.binding, p.id)}`];
        if (s && d) {
          const a = mid(s);
          const b = mid(d);
          next[p.id] = {
            x: a.x,
            y: a.y,
            w: Math.hypot(b.x - a.x, b.y - a.y),
            a: Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI),
          };
        }
      }
      setChannels((prev) => {
        const keys = Object.keys(next);
        const same =
          keys.length === Object.keys(prev).length &&
          keys.every((k) => {
            const a = prev[k];
            const b = next[k];
            return a !== undefined && a.x === b.x && a.y === b.y && a.w === b.w && a.a === b.a;
          });
        return same ? prev : next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (mapRef.current) ro.observe(mapRef.current);
    return () => ro.disconnect();
  });

  const reservoirClick = (r: { id: Binding; accountId?: string }): void => {
    if (
      selectedProfile &&
      r.id !== channelTarget(selectedProfile.binding, selectedProfile.id) &&
      !scenario.migration &&
      !mock.pendingRebind
    ) {
      mock.requestRebind(selectedProfile.id, r.id);
      return;
    }
    if (r.accountId) setTray({ kind: 'account', id: r.accountId });
  };

  const affected = mock.disconnectTarget
    ? scenario.profiles.filter((p) => p.binding === mock.disconnectTarget!.id)
    : [];
  const pendingProfile = mock.pendingRebind
    ? scenario.profiles.find((p) => p.id === mock.pendingRebind!.profileId)
    : undefined;
  const systemBusy =
    mock.pendingSystemAccount != null &&
    scenario.connections.find((c) => c.id === mock.pendingSystemAccount)?.state === 'syncing';

  return (
    <div className={styles.root}>
      <div className={styles.edge}>
        <span className={`${styles.status} ${styles[`tone-${summary.tone}`]}`}>
          <Icon name={summary.icon} size={14} />
          {summary.label}
        </span>
        {!isFirstUse && summary.tone === 'ok' && !mock.syncing && (
          <span className={styles.edgeMeta}>Last synced {scenario.lastSync}</span>
        )}
        {!isFirstUse && (
          <button
            type="button"
            className={styles.edgeBtn}
            onClick={mock.syncNow}
            disabled={mock.syncing}
          >
            <Icon name="repeat" size={14} />
            {mock.syncing ? 'Syncing…' : 'Sync now'}
          </button>
        )}
      </div>

      <div
        className={styles.map}
        ref={mapRef}
        role="group"
        aria-label="Profile destinations map"
      >
        {Object.entries(channels).map(([pid, ch]) => {
          const moving = scenario.migration?.profileId === pid;
          const dimmed = !!selectedProfile && selectedProfile.id !== pid;
          return (
            <div
              key={pid}
              aria-hidden="true"
              className={`${styles.channel}${moving ? ` ${styles.channelMoving}` : ''}${dimmed ? ` ${styles.channelDim}` : ''}`}
              style={{
                inlineSize: ch.w,
                transform: `translate(${ch.x}px, ${ch.y}px) rotate(${ch.a}deg)`,
              }}
            >
              {moving && <span className={styles.packet} />}
            </div>
          );
        })}

        {scenario.migration && channels[scenario.migration.profileId] && (
          <span
            className={styles.channelLabel}
            role="status"
            style={{
              insetInlineStart:
                channels[scenario.migration.profileId].x +
                channels[scenario.migration.profileId].w / 2,
              insetBlockStart: channels[scenario.migration.profileId].y,
            }}
          >
            Copying {scenario.migration.progress}% — old cloud copy is untouched
          </span>
        )}

        {isEmpty ? (
          <div className={styles.mapEmpty}>
            <span className={styles.emptyMark} aria-hidden="true">
              <Icon name="languages" size={20} />
            </span>
            <p className={styles.emptyText}>No profile sources yet</p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={mock.openProfileSettings}
            >
              <Icon name="plus" size={14} />
              Create language profile
            </button>
          </div>
        ) : (
          <>
            <div className={`${styles.bank} ${styles.bankSources}`}>
              {scenario.profiles.map((p) => {
                const st = profileStatus(p, scenario.connections);
                return (
                  <button
                    key={p.id}
                    type="button"
                    ref={(el) => {
                      nodeRefs.current[`src-${p.id}`] = el;
                    }}
                    className={`${styles.node} ${styles.source}${selectedProfile?.id === p.id ? ` ${styles.nodeOn}` : ''}`}
                    aria-pressed={selectedProfile?.id === p.id}
                    aria-label={`${p.language} — ${st.label}, stored in ${accountLabel(
                      channelTarget(p.binding, p.id),
                      scenario.connections,
                    )}`}
                    onClick={() => setTray({ kind: 'profile', id: p.id })}
                  >
                    <Icon name="languages" size={14} />
                    <span className={styles.nodeName}>{p.language}</span>
                    <span className={`${styles.nodeState} ${styles[`tone-${st.tone}`]}`}>
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={`${styles.bank} ${styles.bankReservoirs}`}>
              {isFirstUse && (
                <div className={styles.reservoirEmpty}>
                  <button type="button" className={styles.primaryBtn} onClick={mock.connect}>
                    <span className={styles.gmark} aria-hidden="true">G</span>
                    Connect Google Drive
                  </button>
                </div>
              )}

              {reservoirs.map((r) => {
                const account = scenario.connections.find((c) => c.id === r.accountId);
                const st = account ? connectionStatus(account) : null;
                const isOldCopySource = mock.completedRebind?.from === r.id;
                return (
                  <div key={r.id} className={styles.reservoirWrap}>
                    <button
                      type="button"
                      ref={(el) => {
                        nodeRefs.current[`dst-${r.id}`] = el;
                      }}
                      className={`${styles.node} ${styles.reservoir}${r.id === 'local' ? ` ${styles.reservoirDevice}` : ''}${trayAccount?.id === r.accountId ? ` ${styles.nodeOn}` : ''}`}
                      aria-label={
                        account
                          ? `${account.email} reservoir — ${st!.label}${account.system ? ', system storage' : ''}`
                          : 'This device reservoir'
                      }
                      onClick={() => reservoirClick(r)}
                    >
                      <span className={styles.nodeName}>
                        {r.id === 'local' ? 'This device' : r.label}
                      </span>
                      {account?.system && (
                        <span className={styles.sysMark}>System storage</span>
                      )}
                      {st && (
                        <span className={`${styles.nodeState} ${styles[`tone-${st.tone}`]}`}>
                          <Icon name={st.icon} size={12} />
                          {st.label}
                        </span>
                      )}
                    </button>
                    {isOldCopySource && (
                      <div className={styles.echo} role="group" aria-label="Old cloud copy">
                        <span>
                          {scenario.profiles.find(
                            (p) => p.id === mock.completedRebind!.profileId,
                          )?.language ?? 'Profile'}{' '}
                          moved. Keep the old cloud copy?
                        </span>
                        <span className={styles.echoActions}>
                          <button
                            type="button"
                            className={styles.trayPrimary}
                            onClick={mock.keepOldCopy}
                            autoFocus
                          >
                            Keep old copy
                          </button>
                          <button
                            type="button"
                            className={styles.trayDanger}
                            onClick={mock.deleteOldCopy}
                          >
                            Delete old copy
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedProfile && !isFirstUse && (
        <p className={styles.hint}>
          Pick a reservoir on the right to move {selectedProfile.language}.
        </p>
      )}

      {!isEmpty && (
      <div className={styles.tray} role="group" aria-label="Actions">
        {trayAccount ? (
          <>
            <div className={styles.trayHead}>
              <strong>{trayAccount.email}</strong>
              {trayAccount.system && <span className={styles.sysMark}>System storage</span>}
              <span
                className={`${styles.status} ${styles[`tone-${connectionStatus(trayAccount).tone}`]}`}
              >
                <Icon name={connectionStatus(trayAccount).icon} size={12} />
                {connectionStatus(trayAccount).label}
              </span>
            </div>
            <div className={styles.trayActions}>
              {(() => {
                const action = accountAction(trayAccount, mock);
                const disconnectBlocked =
                  (trayAccount.system && otherConnected) || !!mock.pendingSystemAccount;
                return (
                  <>
                    {action && (
                      <button type="button" className={styles.trayPrimary} onClick={action.run}>
                        {action.label}
                      </button>
                    )}
                    {!trayAccount.system && (
                      <button
                        type="button"
                        className={styles.trayBtn}
                        onClick={() => mock.requestSystemChange(trayAccount.id)}
                      >
                        Make system storage
                      </button>
                    )}
                    {disconnectBlocked ? (
                      <span className={styles.blocked}>Choose another system storage first</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.trayDanger}
                        onClick={() => mock.requestDisconnect(trayAccount.id)}
                      >
                        Disconnect…
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        ) : selectedProfile ? (
          <>
            <div className={styles.trayHead}>
              <strong>{selectedProfile.language}</strong>
              <span className={styles.trayMeta}>
                Stored in{' '}
                {accountLabel(
                  channelTarget(selectedProfile.binding, selectedProfile.id),
                  scenario.connections,
                )}
              </span>
              <span
                className={`${styles.status} ${styles[`tone-${profileStatus(selectedProfile, scenario.connections).tone}`]}`}
              >
                <Icon
                  name={profileStatus(selectedProfile, scenario.connections).icon}
                  size={12}
                />
                {profileStatus(selectedProfile, scenario.connections).label}
              </span>
            </div>
            <div className={styles.trayActions}>
              {(() => {
                const pAction = profileAction(selectedProfile, mock);
                const bound = scenario.connections.find(
                  (c) => c.id === selectedProfile.binding,
                );
                const aAction = bound && selectedProfile.state === 'waiting'
                  ? accountAction(bound, mock)
                  : null;
                const action = pAction ?? aAction;
                return action ? (
                  <button type="button" className={styles.trayPrimary} onClick={action.run}>
                    {action.label}
                  </button>
                ) : null;
              })()}
            </div>
          </>
        ) : (
          <span className={styles.trayMeta}>Select a profile or a reservoir on the map.</span>
        )}
        {scenario.connections.length === 1 && (
          <button type="button" className={styles.trayBtn} onClick={mock.connectAnother}>
            Connect another account
          </button>
        )}
      </div>
      )}

      {mock.notice && (
        <p className={styles.notice} role="status" aria-live="polite">
          {mock.notice}
        </p>
      )}

      <details className={styles.privacy}>
        <summary>What gets synced</summary>
        <p>
          Profiles, dictionaries, study progress, Reader books, settings, and subtitle API keys
          follow the channel you choose. Your data stays in your app data folder and the old
          cloud copy is always kept by default.
        </p>
      </details>

      {mock.pendingRebind && pendingProfile && (
        <FocusDialog labelledBy="b-rd" className={styles.sheet} onClose={mock.cancelRebind}>
            <p className={styles.sheetContext}>
              {pendingProfile.language} ·{' '}
              {accountLabel(mock.pendingRebind.from, scenario.connections)} →{' '}
              {accountLabel(mock.pendingRebind.to, scenario.connections)}
            </p>
            {mock.pendingRebind.from === 'local' ? (
              <>
                <h2 id="b-rd" className={styles.sheetTitle}>
                  Start syncing {pendingProfile.language} to{' '}
                  {accountLabel(mock.pendingRebind.to, scenario.connections)}?
                </h2>
                <p className={styles.sheetBody}>
                  Cell uploads and verifies this profile before showing it as protected.
                </p>
              </>
            ) : (
              <>
                <h2 id="b-rd" className={styles.sheetTitle}>
                  Move {pendingProfile.language} to{' '}
                  {accountLabel(mock.pendingRebind.to, scenario.connections)}?
                </h2>
                <p className={styles.sheetBody}>
                  Cell copies and verifies this profile before changing its destination. The
                  current cloud copy stays untouched.
                </p>
              </>
            )}
            <div className={styles.sheetActions}>
              <button type="button" className={styles.trayBtn} onClick={mock.cancelRebind} autoFocus>
                Cancel
              </button>
              <button type="button" className={styles.trayPrimary} onClick={mock.confirmRebind}>
                Copy and move
              </button>
            </div>
        </FocusDialog>
      )}

      {mock.pendingSystemAccount && (
        <FocusDialog
          labelledBy="b-sd"
          className={styles.sheet}
          busy={!!systemBusy}
          onClose={mock.cancelSystemChange}
        >
            <h2 id="b-sd" className={styles.sheetTitle}>
              Use {ACCOUNT_LABELS[mock.pendingSystemAccount]} for system storage?
            </h2>
            {systemBusy ? (
              <p className={styles.sheetBody} role="status">Copying shared settings…</p>
            ) : (
              <p className={styles.sheetBody}>
                Cell copies and verifies shared settings before switching system storage.
                Profile destinations stay unchanged.
              </p>
            )}
            <div className={styles.sheetActions}>
              <button
                type="button"
                className={styles.trayBtn}
                onClick={mock.cancelSystemChange}
                disabled={systemBusy}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.trayPrimary}
                onClick={mock.confirmSystemChange}
                disabled={systemBusy}
              >
                Copy and switch
              </button>
            </div>
        </FocusDialog>
      )}

      {mock.disconnectTarget && (
        <FocusDialog labelledBy="b-dd" className={styles.sheet} onClose={mock.cancelDisconnect}>
            <p className={styles.sheetContext}>
              Channels pausing: {affected.map((p) => p.language).join(', ') || 'none'}
            </p>
            <h2 id="b-dd" className={styles.sheetTitle}>
              Disconnect {mock.disconnectTarget.email}?
            </h2>
            <p className={styles.sheetBody}>
              Local data stays intact and your cloud copy is kept.
            </p>
            <div className={styles.sheetActions}>
              <button type="button" className={styles.trayBtn} onClick={mock.cancelDisconnect} autoFocus>
                Cancel
              </button>
              <button type="button" className={styles.trayDanger} onClick={mock.confirmDisconnect}>
                Disconnect
              </button>
            </div>
        </FocusDialog>
      )}
    </div>
  );
}
