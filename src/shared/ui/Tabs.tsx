import { createContext, useContext, useState, useCallback, useMemo, type ReactNode, type ButtonHTMLAttributes, type HTMLAttributes } from 'react';
import styles from './Tabs.module.css';

interface TabsContextValue {
  value: string;
  setValue: (next: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs compound components must be used inside <Tabs>');
  return ctx;
}

interface TabsProps {
  /** Controlled active tab value. */
  value?: string;
  /** Called when active tab changes. */
  onValueChange?: (value: string) => void;
  /** Default active tab for uncontrolled usage. */
  defaultValue?: string;
  children: ReactNode;
}

function Tabs({ value: controlledValue, onValueChange, defaultValue, children }: TabsProps): React.JSX.Element {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const setValue = useCallback(
    (next: string): void => {
      if (controlledValue === undefined) setInternalValue(next);
      onValueChange?.(next);
    },
    [controlledValue, onValueChange],
  );

  const context = useMemo(
    () => ({ value, setValue }),
    [value, setValue],
  );

  return <TabsContext.Provider value={context}>{children}</TabsContext.Provider>;
}

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function TabsList({ children, className, ...rest }: TabsListProps): React.JSX.Element {
  return <div className={[styles.list, className ?? ''].filter(Boolean).join(' ')} role="tablist" {...rest}>{children}</div>;
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: ReactNode;
}

function TabsTrigger({ value: tabValue, children, className, ...rest }: TabsTriggerProps): React.JSX.Element {
  const { value, setValue } = useTabs();

  return (
    <button
      type="button"
      className={[styles.trigger, value === tabValue ? styles.active : '', className ?? ''].filter(Boolean).join(' ')}
      role="tab"
      aria-selected={value === tabValue}
      onClick={() => setValue(tabValue)}
      {...rest}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function TabsContent({ value: tabValue, children, className }: TabsContentProps): React.JSX.Element | null {
  const { value } = useTabs();
  if (value !== tabValue) return null;

  return (
    <div className={[styles.content, className ?? ''].filter(Boolean).join(' ')} role="tabpanel">
      {children}
    </div>
  );
}

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;

export { Tabs };
