import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
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
import styles from './ConceptC.module.css';

const CONTENTS = ['Dictionaries', 'Study history', 'Reader books', 'Profile settings'];

type DocId = string;

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

function initialDoc(s: MockScenario): DocId {
  if (s.migration) return s.migration.profileId;
  const troubled = s.profiles.find(
    (p) => p.state === 'waiting' || p.state === 'local-storage-full',
  );
  if (troubled) return troubled.id;
  return s.profiles[0]?.id ?? 'en';
}

export function ConceptC({ mock }: { mock: SyncMock }): ReactElement {
  const { scenario } = mock;
  const isFirstUse = scenario.connections.length === 0;
  const isEmpty = scenario.connections.length === 0 && scenario.profiles.length === 0;
  const otherConnected = scenario.connections.length > 1;
  const [doc, setDoc] = useState<DocId>(() => initialDoc(scenario));
  const [pickingDest, setPickingDest] = useState(false);
  const summary = summaryStatus(scenario, mock.syncing);

  const profile = scenario.profiles.find((p) => p.id === doc);
  const sharedOpen = doc === 'shared';
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

  const tabIds: DocId[] = [...scenario.profiles.map((p) => p.id), 'shared'];

  const onTabKey = (e: ReactKeyboardEvent<HTMLButtonElement>, id: DocId): void => {
    const idx = tabIds.indexOf(id);
    if (idx === -1) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabIds.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabIds.length) % tabIds.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabIds.length - 1;
    if (next === -1) return;
    e.preventDefault();
    const nextId = tabIds[next];
    setDoc(nextId);
    setPickingDest(false);
    document.getElementById(`doc-tab-${nextId}`)?.focus();
  };

  const renderProfilePage = (p: MockProfile): ReactElement => {
    const st = profileStatus(p, scenario.connections);
    const migrating = scenario.migration?.profileId === p.id;
    const decided = mock.completedRebind?.profileId === p.id;
    const pAction = profileAction(p, mock);
    const bound = scenario.connections.find((c) => c.id === p.binding);
    const aAction = bound && p.state === 'waiting' ? accountAction(bound, mock) : null;
    const action = pAction ?? aAction;
    return (
      <article className={styles.spread} aria-label={`${p.language} passport`}>
        <div className={styles.page}>
          <h2 className={styles.coverTitle}>{p.language}</h2>
          <div className={styles.stampRow}>
            {pickingDest ? (
              <div className={styles.stampChoices} role="group" aria-label={`Destination for ${p.language}`}>
                {destinations.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`${styles.stamp} ${styles.stampChoice}${p.binding === d.id ? ` ${styles.stampOn}` : ''}`}
                    disabled={migrating || p.state === 'waiting' || !!mock.pendingRebind}
                    onClick={() => {
                      setPickingDest(false);
                      mock.requestRebind(p.id, d.id);
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className={`${styles.stamp}${p.binding === 'local' ? ` ${styles.stampVoid}` : ''}`}>
                <span className={styles.stampLabel}>Destination</span>
                <span className={styles.stampValue}>
                  {accountLabel(migrating ? scenario.migration!.from : p.binding, scenario.connections)}
                </span>
              </div>
            )}
            <div className={`${styles.stamp} ${styles[`tone-${st.tone}`]}`}>
              <span className={styles.stampLabel}>Status</span>
              <span className={styles.stampValue}>
                <Icon name={st.icon} size={14} />
                {st.label}
              </span>
            </div>
          </div>
          {!isFirstUse && !pickingDest && !migrating && (
            <button
              type="button"
              className={styles.textBtn}
              data-dialog-restore
              onClick={() => setPickingDest(true)}
            >
              Change destination
            </button>
          )}
          {pickingDest && (
            <button type="button" className={styles.textBtn} onClick={() => setPickingDest(false)}>
              Cancel
            </button>
          )}
          {action && (
            <button type="button" className={styles.primaryBtn} onClick={action.run}>
              {action.label}
            </button>
          )}
          {isFirstUse && (
            <button type="button" className={styles.primaryBtn} onClick={mock.connect}>
              <span className={styles.gmark} aria-hidden="true">G</span>
              Connect Google Drive
            </button>
          )}
        </div>
        <div className={styles.page}>
          {migrating && (
            <div className={styles.verifyStrip} role="status">
              <progress
                value={scenario.migration!.progress}
                max={100}
                aria-label={`Moving ${p.language}`}
              />
              <span>
                Verifying copy to{' '}
                {accountLabel(scenario.migration!.to, scenario.connections)} —{' '}
                {scenario.migration!.progress}%. Old cloud copy is untouched.
              </span>
            </div>
          )}
          <h3 className={styles.recordTitle}>Contents record</h3>
          <ul className={styles.record}>
            {CONTENTS.map((item) => (
              <li key={item}>
                <Icon name="check" size={14} />
                {item}
              </li>
            ))}
          </ul>
          {decided && (
            <div className={styles.visa} role="group" aria-label={`Old copy for ${p.language}`}>
              <span>
                {p.language} is now stored in{' '}
                {accountLabel(mock.completedRebind!.to, scenario.connections)}. Keep the old
                cloud copy?
              </span>
              <span className={styles.visaActions}>
                <button type="button" className={styles.primaryBtn} onClick={mock.keepOldCopy} autoFocus>
                  Keep old copy
                </button>
                <button type="button" className={styles.dangerBtn} onClick={mock.deleteOldCopy}>
                  Delete old copy
                </button>
              </span>
            </div>
          )}
        </div>
      </article>
    );
  };

  const renderSharedPage = (): ReactElement => {
    const system = scenario.connections.find((c) => c.system);
    const others = scenario.connections.filter((c) => !c.system);
    return (
      <article className={styles.spread} aria-label="Shared settings passport">
        <div className={styles.page}>
          <h2 className={styles.coverTitle}>Shared settings</h2>
          {system ? (
            <div className={`${styles.stamp} ${styles.seal}`}>
              <span className={styles.stampLabel}>System storage</span>
              <span className={styles.sealValue}>{system.email}</span>
            </div>
          ) : (
            <div className={`${styles.stamp} ${styles.stampVoid}`}>
              <span className={styles.stampLabel}>System storage</span>
              <span className={styles.stampValue}>Not connected</span>
            </div>
          )}
          {others.length > 0 && (
            <div className={styles.candidates} role="group" aria-label="Candidate system accounts">
              {others.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.stamp} ${styles.stampChoice}`}
                  disabled={!!mock.pendingSystemAccount}
                  onClick={() => mock.requestSystemChange(c.id)}
                >
                  {c.email}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.page}>
          <h3 className={styles.recordTitle}>Wallet pocket</h3>
          <div className={styles.pocket}>
            {scenario.connections.map((c) => {
              const st = connectionStatus(c);
              const action = accountAction(c, mock);
              const disconnectBlocked =
                (c.system && otherConnected) || !!mock.pendingSystemAccount;
              return (
                <div key={c.id} className={styles.pocketRow}>
                  <span className={styles.pocketName}>{c.email}</span>
                  <span className={`${styles.pocketState} ${styles[`tone-${st.tone}`]}`}>
                    <Icon name={st.icon} size={12} />
                    {st.label}
                  </span>
                  <span className={styles.pocketActions}>
                    {action && (
                      <button type="button" className={styles.primaryBtn} onClick={action.run}>
                        {action.label}
                      </button>
                    )}
                    {disconnectBlocked ? (
                      <span className={styles.blocked}>Choose another system storage first</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.textBtn}
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
            {scenario.connections.length > 0 && (
              <button
                type="button"
                className={styles.textBtn}
                onClick={mock.syncNow}
                disabled={mock.syncing}
              >
                <Icon name="repeat" size={14} />
                {mock.syncing ? 'Syncing…' : 'Sync now'}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderEmpty = (): ReactElement => (
    <article className={styles.spread} aria-label="Profile wallet">
      <div className={`${styles.page} ${styles.emptyPage}`}>
        <span className={styles.emptyDoc} aria-hidden="true">
          <Icon name="languages" size={20} />
        </span>
        <h2 className={styles.coverTitle}>No profile documents yet</h2>
        <p className={styles.emptyHint}>
          Create a language profile to keep its dictionaries and progress safe.
        </p>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={mock.openProfileSettings}
        >
          <Icon name="plus" size={14} />
          Create language profile
        </button>
      </div>
    </article>
  );

  return (
    <div className={styles.root}>
      {!isEmpty && (
        <nav className={styles.index} aria-label="Documents" role="tablist">
          {scenario.profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`doc-tab-${p.id}`}
              aria-controls={`doc-panel-${p.id}`}
              aria-selected={doc === p.id}
              tabIndex={doc === p.id ? 0 : -1}
              className={`${styles.tab}${doc === p.id ? ` ${styles.tabOn}` : ''}`}
              onClick={() => {
                setDoc(p.id);
                setPickingDest(false);
              }}
              onKeyDown={(e) => onTabKey(e, p.id)}
            >
              {p.language}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            id="doc-tab-shared"
            aria-controls="doc-panel-shared"
            aria-selected={sharedOpen}
            tabIndex={sharedOpen ? 0 : -1}
            className={`${styles.tab}${sharedOpen ? ` ${styles.tabOn}` : ''}`}
            onClick={() => {
              setDoc('shared');
              setPickingDest(false);
            }}
            onKeyDown={(e) => onTabKey(e, 'shared')}
          >
            Shared settings
          </button>
        </nav>
      )}

      <div className={styles.main}>
        <div className={styles.docLine} role="status">
          <span className={`${styles.status} ${styles[`tone-${summary.tone}`]}`}>
            <Icon name={summary.icon} size={14} />
            {summary.label}
          </span>
          {!isFirstUse && summary.tone === 'ok' && !mock.syncing && (
            <span className={styles.docMeta}>Last synced {scenario.lastSync}</span>
          )}
        </div>

        {isEmpty ? (
          renderEmpty()
        ) : (
          <div
            role="tabpanel"
            id={`doc-panel-${sharedOpen ? 'shared' : (profile?.id ?? doc)}`}
            aria-labelledby={`doc-tab-${sharedOpen ? 'shared' : (profile?.id ?? doc)}`}
            className={styles.panel}
          >
            {sharedOpen ? renderSharedPage() : profile ? renderProfilePage(profile) : null}
          </div>
        )}

        {mock.notice && (
          <p className={styles.notice} role="status" aria-live="polite">
            {mock.notice}
          </p>
        )}

        <p className={styles.finePrint}>
          Sync covers profiles, dictionaries, study progress, Reader books, settings, and
          subtitle API keys. Your data stays in your app data folder; the old cloud copy is
          always kept by default.
        </p>
      </div>

      {mock.pendingRebind && pendingProfile && (
        <FocusDialog labelledBy="c-rd" className={styles.insert} onClose={mock.cancelRebind}>
            <span className={styles.insertBand} aria-hidden="true" />
            {mock.pendingRebind.from === 'local' ? (
              <>
                <h3 id="c-rd" className={styles.insertTitle}>
                  Start syncing {pendingProfile.language} to{' '}
                  {accountLabel(mock.pendingRebind.to, scenario.connections)}?
                </h3>
                <p className={styles.insertBody}>
                  Cell uploads and verifies this profile before showing it as protected.
                </p>
              </>
            ) : (
              <>
                <h3 id="c-rd" className={styles.insertTitle}>
                  Move {pendingProfile.language} to{' '}
                  {accountLabel(mock.pendingRebind.to, scenario.connections)}?
                </h3>
                <p className={styles.insertBody}>
                  Cell copies and verifies this profile before changing its destination. The
                  current cloud copy stays untouched.
                </p>
              </>
            )}
            <div className={styles.insertActions}>
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
          labelledBy="c-sd"
          className={styles.insert}
          busy={!!systemBusy}
          onClose={mock.cancelSystemChange}
        >
            <span className={styles.insertBand} aria-hidden="true" />
            <h3 id="c-sd" className={styles.insertTitle}>
              Use {ACCOUNT_LABELS[mock.pendingSystemAccount]} for system storage?
            </h3>
            {systemBusy ? (
              <p className={styles.insertBody} role="status">Copying shared settings…</p>
            ) : (
              <p className={styles.insertBody}>
                Cell copies and verifies shared settings before switching system storage.
                Profile destinations stay unchanged.
              </p>
            )}
            <div className={styles.insertActions}>
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
        <FocusDialog labelledBy="c-dd" className={styles.insert} onClose={mock.cancelDisconnect}>
            <span className={styles.insertBand} aria-hidden="true" />
            <h3 id="c-dd" className={styles.insertTitle}>
              Disconnect {mock.disconnectTarget.email}?
            </h3>
            <p className={styles.insertBody}>
              Affected profiles: {affected.map((p) => p.language).join(', ') || 'none'}.
            </p>
            <p className={styles.insertBody}>
              Local data stays intact and your cloud copy is kept.
            </p>
            <div className={styles.insertActions}>
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
