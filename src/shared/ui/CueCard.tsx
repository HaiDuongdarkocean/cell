import { forwardRef, type ComponentPropsWithoutRef, type ReactNode, type Ref } from 'react';
import styles from './CueCard.module.css';

type CueCardRegionProps = ComponentPropsWithoutRef<'div'> & {
  readonly [key: `data-${string}`]: string | boolean | undefined;
};

export interface CueCardProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title' | 'content'> {
  readonly current?: boolean;
  readonly upcoming?: boolean;
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly content?: ReactNode;
  readonly actions?: ReactNode;
  readonly textProps?: CueCardRegionProps;
}

export const CueCard = forwardRef<HTMLDivElement, CueCardProps>(function CueCard(
  { current = false, upcoming = false, title, subtitle, actions, content, textProps, className, ...rest },
  ref: Ref<HTMLDivElement>,
): React.JSX.Element {
  const cardClassName = [styles.card, current ? styles.cardCurrent : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const textClassName = [styles.text, textProps?.className ?? ''].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      {...rest}
      className={cardClassName}
      data-current={current ? 'true' : 'false'}
      data-upcoming={upcoming ? 'true' : 'false'}
    >
      {content !== undefined ? (
        content
      ) : (
        <div {...textProps} className={textClassName} data-allow-lookup>
          <div className={styles.targetText} data-cell-id="cue-target-text">
            {title}
          </div>
          {subtitle !== undefined && subtitle !== null && (
            <div className={styles.nativeText} data-cell-id="cue-native-text">
              {subtitle}
            </div>
          )}
        </div>
      )}
      <div className={styles.actions} data-cell-id="cue-actions">
        {actions}
      </div>
    </div>
  );
});
