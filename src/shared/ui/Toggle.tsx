import { type ReactElement, useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import styles from './Toggle.module.css';

gsap.registerPlugin(MorphSVGPlugin);

type ToggleSize = 'sm' | 'md' | 'lg';

export interface ToggleProps {
  /** Current checked state */
  checked: boolean;
  /** Called when toggle state changes */
  onChange: (next: boolean) => void;
  /** Accessibility label for screen readers */
  ariaLabel: string;
  /** Size. Default: sm. */
  size?: ToggleSize;
  /** Optional HTML id */
  id?: string;
  /** Optional data-cell-id for testing */
  dataTestId?: string;
  /** Optional title attribute */
  title?: string;
  /** Optional form field name */
  name?: string;
  /** When true, toggle is disabled (not clickable, dimmed). */
  disabled?: boolean;
}

/** Base dot — a circle on the left half of the 36×18 viewBox. */
const DOT_BASE =
  'M18 9C18 13.9706 13.9706 18 9 18C4.02944 18 0 13.9706 0 9C0 4.02944 4.02944 0 9 0C13.9706 0 18 4.02944 18 9Z';

/** Slightly stretched dot on hover. */
const DOT_HOVER =
  'M20 9C20 13.9706 13.9706 18 9 18C4.02944 18 0 13.9706 0 9C0 4.02944 4.02944 0 9 0C13.9706 0 20 5.02944 20 9Z';

/** Mid-animated dot shapes for the elastic click. */
const CLICK_KEYFRAMES: string[] = [
  'M36 9C36 15.9706 13.9706 18 9 18C4.02944 18 0 13.9706 0 9C0 4.02944 4.02944 0 9 0C13.9706 0 36 2.02944 36 9Z',
  'M35.9954 9C35.9954 13.9706 31.9659 18 26.9954 18C22.0248 18 23.9954 12.9706 23.9954 9C23.9954 5.02944 22.0248 0 26.9954 0C31.9659 0 35.9954 4.02944 35.9954 9Z',
  'M36 9C36 13.9706 31.9706 18 27 18C22.0294 18 18 13.9706 18 9C18 4.02944 22.0294 0 27 0C31.9706 0 36 4.02944 36 9Z',
];

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Toggle({
  checked,
  onChange,
  ariaLabel,
  size = 'sm',
  id,
  dataTestId,
  title,
  name,
  disabled,
}: ToggleProps): ReactElement {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;

  const [visualChecked, setVisualChecked] = useState(checked);
  const isAnimatingRef = useRef(false);
  const targetRef = useRef(checked);
  const tweenRef = useRef<ReturnType<typeof gsap.to> | null>(null);
  const mountedRef = useRef(true);
  const pathRef = useRef<SVGPathElement>(null);
  const labelRef = useRef<HTMLLabelElement>(null);

  const runToggleAnimation = (target: boolean): void => {
    const path = pathRef.current;
    if (!path) return;

    tweenRef.current?.kill();
    isAnimatingRef.current = true;
    targetRef.current = target;

    tweenRef.current = gsap.to(path, {
      keyframes: [
        { morphSVG: CLICK_KEYFRAMES[0], duration: 0.15 },
        { morphSVG: CLICK_KEYFRAMES[1], duration: 0.15 },
        {
          morphSVG: CLICK_KEYFRAMES[2],
          duration: 0.5,
          ease: 'elastic.out(1, 0.8)',
          onComplete: () => {
            if (!mountedRef.current) return;
            labelRef.current?.classList.toggle(styles.checked, target);
            path.setAttribute('d', DOT_BASE);
            setVisualChecked(target);
            isAnimatingRef.current = false;
          },
        },
      ],
    });
  };

  useEffect(() => {
    if (checked === visualChecked) return;
    if (!pathRef.current) return;

    if (prefersReducedMotion()) {
      labelRef.current?.classList.toggle(styles.checked, checked);
      pathRef.current?.setAttribute('d', DOT_BASE);
      setVisualChecked(checked);
      return;
    }

    if (isAnimatingRef.current && targetRef.current === checked) return;

    runToggleAnimation(checked);
  }, [checked, visualChecked]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      tweenRef.current?.kill();
    },
    [],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (disabled) return;
    onChange(e.target.checked);
  };

  const handleMouseEnter = (): void => {
    const path = pathRef.current;
    if (disabled || isAnimatingRef.current || !path) return;
    gsap.killTweensOf(path);
    gsap.to(path, { morphSVG: DOT_HOVER, duration: 0.15 });
  };

  const handleMouseLeave = (): void => {
    const path = pathRef.current;
    if (disabled || isAnimatingRef.current || !path) return;
    gsap.killTweensOf(path);
    gsap.to(path, { morphSVG: DOT_BASE, duration: 0.15 });
  };

  const className = `${styles.toggle} ${styles[size]} ${
    visualChecked ? styles.checked : ''
  } ${disabled ? styles.disabled : ''}`;

  return (
    <label
      ref={labelRef}
      className={className}
      htmlFor={inputId}
      title={title}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <input
        id={inputId}
        data-cell-id={dataTestId}
        className={styles.input}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={handleInputChange}
      />
      <svg
        className={styles.thumb}
        viewBox="0 0 36 18"
        preserveAspectRatio="xMinYMid meet"
      >
        <path ref={pathRef} d={DOT_BASE} />
      </svg>
    </label>
  );
}
