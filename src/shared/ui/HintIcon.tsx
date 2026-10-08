import { useState, useRef, useEffect, useCallback, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Icon } from '@/shared/icons/Icon';
import { pushEscapeLayer } from './escapeLayerStack';
import { useDismissOnScroll } from './useDismissOnScroll';
import { getPortalContainer } from './portalContainer';
import styles from './HintIcon.module.css';

/** Props for the HintIcon component. */
export interface HintIconProps {
  /** Hint text to display in popover. */
  hint: string;
  /** Accessible label for the hint button. */
  ariaLabel: string;
  /** Optional HTML id. */
  id?: string;
  /** Optional data-cell-id for the button. */
  dataTestId?: string;
}

type PopoverPos = {
  top: number;
  left: number;
  flip: boolean;
  align: 'left' | 'right' | 'center';
};

/**
 * HintIcon — info-circle button + floating popover with boundary detection
 * (settings-controls-restyle spec F6).
 *
 * Click icon → popover floats above icon with boundary detection:
 * - flip-top: if near top viewport edge, popover appears below icon
 * - align-right: if near left edge, popover right-aligned
 * - align-center: if both sides insufficient, popover centered
 *
 * The popover is portaled out of the trigger subtree: label rows clip
 * children with overflow:hidden, which would hide the tooltip entirely.
 * Fixed positioning from the trigger rect keeps it anchored; it dismisses
 * on outside click, Esc, scroll, or clicking the icon again.
 */
export function HintIcon({
  hint,
  ariaLabel,
  id,
  dataTestId,
}: HintIconProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useDismissOnScroll(isOpen, popoverRef, wrapRef, close);

  useEffect(() => {
    if (!isOpen) return;

    const wrap = wrapRef.current;
    const doc = wrap?.ownerDocument ?? document;
    const win = doc.defaultView ?? window;
    const rootNode = wrap?.getRootNode();
    const scope: Document | ShadowRoot = rootNode instanceof ShadowRoot ? rootNode : doc;

    const popover = popoverRef.current;
    const trigger = wrap?.querySelector('button') ?? wrap;
    if (popover && trigger) {
      const btnRect = trigger.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();
      const pad = 8;
      const gap = 6;
      const flip = btnRect.top < popRect.height + gap + pad;
      const viewportWidth = win.innerWidth;

      let align: PopoverPos['align'] = 'left';
      let left = btnRect.left;
      if (left + popRect.width > viewportWidth - pad) {
        align = 'right';
        left = btnRect.right - popRect.width;
      }
      if (left < pad) {
        align = 'center';
        left = Math.max(
          pad,
          Math.min(btnRect.left + btnRect.width / 2 - popRect.width / 2, viewportWidth - popRect.width - pad),
        );
      }
      setPos({
        top: flip ? btnRect.bottom + gap : btnRect.top - popRect.height - gap,
        left,
        flip,
        align,
      });
    }

    const onClickOutside = (e: Event): void => {
      const target = e.target as Node;
      if (!wrap?.contains(target) && !popoverRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const onResize = (): void => setIsOpen(false);

    scope.addEventListener('mousedown', onClickOutside);
    const popEscapeLayer = pushEscapeLayer(() => setIsOpen(false), doc);
    win.addEventListener('resize', onResize);

    return () => {
      scope.removeEventListener('mousedown', onClickOutside);
      popEscapeLayer();
      win.removeEventListener('resize', onResize);
      setPos(null);
    };
  }, [isOpen]);

  const popover = isOpen ? (
    <div
      ref={popoverRef}
      className={`${styles.hintText} ${pos?.flip ? styles['flip-top'] : ''} ${pos ? styles[`align-${pos.align}`] : ''}`}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      role="tooltip"
    >
      {hint}
    </div>
  ) : null;

  return (
    <span className={styles.hintWrap} ref={wrapRef}>
      <Button shape="circle" variant="ghost" size="sm"
        id={id}
        data-cell-id={dataTestId}
        data-compact-hit
        className={styles.hintBtn}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((v) => !v)}
      >
        <Icon name="info" size="var(--iconbutton-icon-xs)" />
      </Button>
      {popover && createPortal(popover, getPortalContainer(wrapRef.current))}
    </span>
  );
}
