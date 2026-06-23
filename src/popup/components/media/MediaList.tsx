import { useEffect, useRef } from 'react';
import styles from './MediaList.module.css';

interface MediaListProps {
  children: React.ReactNode;
  ariaLabel: string;
}

export function MediaList({ children, ariaLabel }: MediaListProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation within the list
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      const items = Array.from(
        list.querySelectorAll('[role="listitem"] > button, [role="listitem"] > [tabindex="0"]'),
      ) as HTMLElement[];
      const currentIndex = items.findIndex(
        (item) => item === document.activeElement,
      );

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % items.length;
        items[nextIndex]?.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
      }
    };

    list.addEventListener('keydown', handleKeyDown);
    return () => list.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      ref={listRef}
      className={styles.list}
      role="list"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}