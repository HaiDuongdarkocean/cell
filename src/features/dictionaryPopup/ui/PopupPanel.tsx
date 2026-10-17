import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';
import checkStyles from './DictionaryCheckable.module.css';
import styles from './PopupPanel.module.css';

/** Standardized popup panel kit — every tab panel composes these primitives
 *  so spacing (padding/gap/margin) stays on tokens and new surfaces assemble
 *  correctly without re-inventing layout. Checkable rows ride the shared
 *  DictionaryCheckable compound classes — see that file's WARNING before
 *  touching host class names. */

export function Panel({
  id,
  children,
  className,
}: {
  readonly id?: string;
  readonly children: ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div className={`${styles.TihokaPanel} ${className ?? ''}`} {...(id ? { 'data-tihoka-id': id } : {})}>
      {children}
    </div>
  );
}

/** Head row: source/label on the left, action buttons on the right. */
export function PanelHead({
  source,
  actions,
}: {
  readonly source: ReactNode;
  readonly actions?: ReactNode;
}): React.JSX.Element {
  return (
    <div className={styles.TihokaPanelHead}>
      <div className={styles.TihokaPanelHeadSource}>{source}</div>
      {actions && <div className={styles.TihokaPanelHeadActions}>{actions}</div>}
    </div>
  );
}

/** Bare gap list for items laid directly on the panel surface. */
export function PanelList({
  direction = 'vertical',
  gap = 'md',
  wrap = false,
  children,
  id,
  className,
  listRef,
  onScroll,
}: {
  readonly direction?: 'vertical' | 'horizontal';
  readonly gap?: 'sm' | 'md';
  readonly wrap?: boolean;
  readonly children: ReactNode;
  readonly id?: string;
  readonly className?: string;
  readonly listRef?: Ref<HTMLDivElement>;
  readonly onScroll?: () => void;
}): React.JSX.Element {
  const cls = [
    styles.TihokaPanelList,
    direction === 'horizontal' ? styles['TihokaPanelList--horizontal'] : '',
    gap === 'sm' ? styles['TihokaPanelList--sm'] : '',
    wrap ? styles['TihokaPanelList--wrap'] : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      ref={listRef}
      onScroll={onScroll}
      {...(id ? { 'data-tihoka-id': id } : {})}
    >
      {children}
    </div>
  );
}

/** Surface card holding a list of items (the AI answer card pattern). */
export function PanelCard({ children, id }: {
  readonly children: ReactNode;
  readonly id?: string;
}): React.JSX.Element {
  return (
    <div className={styles.TihokaPanelCard} {...(id ? { 'data-tihoka-id': id } : {})}>
      {children}
    </div>
  );
}

/** Check reveal mode: 'dot' = idle dot → box on hover (leading gutter);
 *  'box' = always-visible checkbox. */
export type PanelCheckMode = 'dot' | 'audio' | 'block' | 'image';

function checkMarkup(
  mode: PanelCheckMode,
  checked: boolean,
  loading: boolean,
  indeterminate: boolean,
): React.JSX.Element {
  const boxCls = [
    checkStyles.TihokaDefCheckBox,
    mode === 'audio' && checked ? checkStyles['TihokaAudioCheck--checked'] : '',
    loading ? checkStyles['TihokaDefCheckBox--loading'] : '',
    indeterminate ? checkStyles['TihokaDefCheckBox--indeterminate'] : '',
  ].filter(Boolean).join(' ');
  const box = (
    <span className={boxCls} aria-hidden="true">
      {loading ? <Spinner size="xl" color="accent" /> : <Icon name="check" size="md" />}
    </span>
  );
  if (mode === 'dot') {
    return (
      <span className={`${checkStyles.TihokaDefCheck} ${checked ? checkStyles['TihokaDefCheck--checked'] : ''}`}>
        {box}
      </span>
    );
  }
  return box;
}

const HOST_CLASS: Record<PanelCheckMode, string> = {
  dot: checkStyles.TihokaDefExampleItem,
  audio: checkStyles.TihokaAudioItem,
  block: checkStyles.TihokaTranslateBlock,
  image: checkStyles.TihokaImageCard,
};

const HOST_DISABLED: Record<PanelCheckMode, string> = {
  dot: checkStyles['TihokaDefItem--disabled'],
  audio: checkStyles['TihokaAudioItem--disabled'],
  block: checkStyles['TihokaTranslateBlock--disabled'],
  image: checkStyles['TihokaImageCard--disabled'],
};

export interface PanelItemProps {
  /** Defined → checkable row (role=checkbox, click/keydown toggle). */
  readonly checked?: boolean;
  readonly indeterminate?: boolean;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  /** Check affordance style — maps onto the shared checkable contract. */
  readonly checkMode?: PanelCheckMode;
  readonly padded?: boolean;
  /** Children already act as flex children of the host row (play button +
   *  label stacks) — render them without the body wrapper. */
  readonly bare?: boolean;
  readonly id?: string;
  readonly ariaLabel?: string;
  readonly onToggle?: () => void;
  readonly children: ReactNode;
}

export function PanelItem({
  checked,
  indeterminate = false,
  loading = false,
  disabled = false,
  checkMode = 'dot',
  padded = false,
  bare = false,
  id,
  ariaLabel,
  onToggle,
  children,
}: PanelItemProps): React.JSX.Element {
  const checkable = checked !== undefined;
  const hostCls = checkable ? HOST_CLASS[checkMode] : '';
  const cls = [
    hostCls,
    checkMode === 'block' && checked ? checkStyles['TihokaTranslateBlock--selected'] : '',
    checkMode === 'image' && checked ? checkStyles['TihokaImageCard--selected'] : '',
    disabled && checkable ? HOST_DISABLED[checkMode] : '',
    padded ? styles['TihokaPanelItem--padded'] : '',
    styles.TihokaPanelItem,
  ].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      {...(id ? { 'data-tihoka-id': id } : {})}
      {...(checkable
        ? {
            role: 'checkbox',
            'aria-checked': indeterminate ? 'mixed' : checked,
            'aria-label': ariaLabel,
            'aria-disabled': disabled || undefined,
            tabIndex: disabled ? -1 : 0,
            onClick: disabled ? undefined : onToggle,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.target !== e.currentTarget || disabled) return;
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onToggle?.();
              }
            },
          }
        : {})}
    >
      {checkable && (checkMode === 'dot') && checkMarkup(checkMode, checked, loading, indeterminate)}
      {bare ? children : <div className={styles.TihokaPanelItemBody}>{children}</div>}
      {checkable && checkMode !== 'dot' && checkMarkup(checkMode, checked, loading, indeterminate)}
    </div>
  );
}

/** Bold primary line inside an item. */
export function PanelItemHead({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <div className={styles.TihokaPanelItemHead}>{children}</div>;
}

/** Secondary line inside an item, optional bold label prefix. */
export function PanelItemMeta({
  label,
  children,
}: {
  readonly label?: string;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <div className={styles.TihokaPanelItemMeta}>
      {label && <b className={styles.TihokaPanelItemLabel}>{label} </b>}
      {children}
    </div>
  );
}

/** Small secondary notice line (failover, hints). */
export function PanelNotice({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <p className={styles.TihokaPanelNotice}>{children}</p>;
}
