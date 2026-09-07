import { createContext, useContext, useRef, useState, useCallback, useMemo, type ReactNode, type ButtonHTMLAttributes, type HTMLAttributes, type KeyboardEvent } from 'react';
import { Button } from '@/shared/ui/Button';
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
  const listRef = useRef<HTMLDivElement>(null);
  const { setValue } = useTabs();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      const tabs = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
      if (tabs.length === 0) return;
      const activeIndex = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
      const currentIndex = activeIndex >= 0 ? activeIndex : 0;

      let nextIndex = currentIndex;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = currentIndex >= tabs.length - 1 ? 0 : currentIndex + 1;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      const nextValue = tabs[nextIndex]?.getAttribute('data-value');
      if (nextValue) {
        setValue(nextValue);
        tabs[nextIndex]?.focus();
      }
    },
    [setValue],
  );

  return (
    <div
      ref={listRef}
      className={[styles.list, className ?? ''].filter(Boolean).join(' ')}
      role="tablist"
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: ReactNode;
}

function TabsTrigger({ value: tabValue, children, className, ...rest }: TabsTriggerProps): React.JSX.Element {
  const { value, setValue } = useTabs();
  const isActive = value === tabValue;

  return (
    <Button variant="secondary"
      className={[styles.trigger, isActive ? styles.active : '', className ?? ''].filter(Boolean).join(' ')}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      data-value={tabValue}
      onClick={() => setValue(tabValue)}
      {...rest}
    >
      {children}
    </Button>
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
    <div
      className={[styles.content, className ?? ''].filter(Boolean).join(' ')}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;

export { Tabs };
