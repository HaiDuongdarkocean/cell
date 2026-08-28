import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Button } from './Button';
import styles from './ErrorBoundary.module.css';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * ErrorBoundary — catches render errors in the subtree and shows
 * a fallback with a reload button. Must be a class component because
 * React requires `componentDidCatch` / `getDerivedStateFromError`
 * (no hooks-based error boundary exists).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className={styles.root} role="alert">
          <div className={styles.icon}>
            <Icon name="triangleAlert" size={40} />
          </div>
          <div className={styles.title}>Something went wrong</div>
          <div className={styles.description}>
            An unexpected error occurred. Reload to try again.
          </div>
          <div className={styles.action}>
            <Button material="solid" type="button" variant="primary" size="sm" onClick={this.handleReload}>
              <Icon name="rotateCcw"  />
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
