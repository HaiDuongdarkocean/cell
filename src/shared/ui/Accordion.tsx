import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import styles from './Accordion.module.css';

type AccordionType = 'single' | 'multiple';

interface AccordionContextValue {
  value: string | string[];
  toggle: (itemValue: string) => void;
  type: AccordionType;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordion(): AccordionContextValue {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('Accordion compound components must be used inside <Accordion>');
  return ctx;
}

interface AccordionItemContextValue {
  value: string;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionItem(): AccordionItemContextValue {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) throw new Error('AccordionItem parts must be inside <Accordion.Item>');
  return ctx;
}

export interface AccordionProps {
  /** Single or multiple expanded items. */
  type?: AccordionType;
  /** Controlled value. */
  value?: string | string[];
  /** Called when value changes. */
  onValueChange?: (value: string | string[]) => void;
  /** Default value for uncontrolled mode. */
  defaultValue?: string | string[];
  children: ReactNode;
}

/**
 * Accordion — collapsible sections, supports single or multiple expanded items.
 */
export function Accordion({
  type = 'single',
  value: controlledValue,
  onValueChange,
  defaultValue,
  children,
}: AccordionProps): React.JSX.Element {
  const [internalValue, setInternalValue] = useState<string | string[]>(
    defaultValue ?? (type === 'multiple' ? [] : ''),
  );

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const toggle = useCallback(
    (itemValue: string): void => {
      let next: string | string[];
      if (type === 'multiple') {
        const current = Array.isArray(value) ? value : [];
        next = current.includes(itemValue) ? current.filter((v) => v !== itemValue) : [...current, itemValue];
      } else {
        next = value === itemValue ? '' : itemValue;
      }
      if (controlledValue === undefined) setInternalValue(next);
      onValueChange?.(next);
    },
    [type, value, controlledValue, onValueChange],
  );

  const context = useMemo(() => ({ value, toggle, type }), [value, toggle, type]);

  return <AccordionContext.Provider value={context}>{children}</AccordionContext.Provider>;
}

export interface AccordionItemProps {
  value: string;
  children: ReactNode;
}

function AccordionItem({ value: itemValue, children }: AccordionItemProps): React.JSX.Element {
  return (
    <AccordionItemContext.Provider value={{ value: itemValue }}>
      <div className={styles.item} data-value={itemValue}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export interface AccordionTriggerProps {
  children: ReactNode;
  className?: string;
}

function AccordionTrigger({ children, className }: AccordionTriggerProps): React.JSX.Element {
  const { value, toggle } = useAccordion();
  const { value: itemValue } = useAccordionItem();
  const expanded = Array.isArray(value) ? value.includes(itemValue) : value === itemValue;

  return (
    <button
      type="button"
      className={[styles.trigger, expanded ? styles.expanded : '', className ?? ''].filter(Boolean).join(' ')}
      aria-expanded={expanded}
      onClick={() => toggle(itemValue)}
    >
      <span className={styles.triggerText}>{children}</span>
      <svg
        className={styles.chevron}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

export interface AccordionContentProps {
  children: ReactNode;
  className?: string;
}

function AccordionContent({ children, className }: AccordionContentProps): React.JSX.Element | null {
  const { value } = useAccordion();
  const { value: itemValue } = useAccordionItem();
  const expanded = Array.isArray(value) ? value.includes(itemValue) : value === itemValue;
  if (!expanded) return null;

  return <div className={[styles.content, className ?? ''].filter(Boolean).join(' ')}>{children}</div>;
}

Accordion.Item = AccordionItem;
Accordion.Trigger = AccordionTrigger;
Accordion.Content = AccordionContent;
