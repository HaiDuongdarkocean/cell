import type { ReactElement, ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { Label } from '@/shared/ui/Label';
import { Select } from '@/shared/ui/Select';
import { FieldRow, FieldAutoGrowInput, TagInput } from './FieldRow';
import { t } from '@/shared/i18n';
import styles from './NoteFieldsEditor.module.css';

export interface NoteEditorField {
  readonly id: string;
  readonly label: string;
  readonly kind: 'text' | 'audio' | 'image';
  readonly placeholder?: string;
  readonly generatable?: boolean;
  readonly dataId?: string;
}

interface NoteFieldsEditorProps {
  readonly fields: readonly NoteEditorField[];
  readonly getText: (id: string) => string;
  readonly onTextChange: (id: string, value: string) => void;
  readonly renderMedia: (id: string) => ReactNode;
  readonly onGenerate?: (id: string) => void;
  readonly generateDisabled?: boolean;
  readonly dataIdPrefix: string;
  readonly tagsValue?: string;
  readonly onTagsChange?: (value: string) => void;
}

export function NoteFieldsEditor({
  fields,
  getText,
  onTextChange,
  renderMedia,
  onGenerate,
  generateDisabled = false,
  dataIdPrefix,
  tagsValue,
  onTagsChange,
}: NoteFieldsEditorProps): ReactElement {
  return (
    <>
      {fields.map((field) => {
        const dataId = field.dataId ?? `${dataIdPrefix}-${field.id}`;
        return (
          <FieldRow
            key={field.id}
            label={field.label}
            dataId={dataId}
            trailing={onGenerate && field.generatable !== false ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onGenerate(field.id)}
                disabled={generateDisabled}
                aria-label={t('cardCreator.action.generateFor', [field.label])}
                title={t('cardCreator.action.generateFor', [field.label])}
                trailingIcon={<Icon name="zap" size="sm" />}
                collapseLabel
                className={styles.generate}
                data-cell-id={`${dataId}-generate`}
              >
                {t('cardCreator.action.create')}
              </Button>
            ) : undefined}
          >
            {field.kind === 'text' ? (
              <FieldAutoGrowInput
                value={getText(field.id)}
                onChange={(v) => onTextChange(field.id, v)}
                placeholder={field.placeholder}
                aria-label={field.label}
                dataId={dataId}
              />
            ) : (
              renderMedia(field.id)
            )}
          </FieldRow>
        );
      })}
      {tagsValue !== undefined && onTagsChange && (
        <FieldRow label={t('cardCreator.field.tags')} dataId={`${dataIdPrefix}-tags`}>
          <TagInput
            value={tagsValue}
            onChange={onTagsChange}
            placeholder={t('cardCreator.placeholder.tags')}
            ariaLabel={t('cardCreator.field.tags')}
            dataId={`${dataIdPrefix}-tags`}
          />
        </FieldRow>
      )}
    </>
  );
}

export function GenerateAllButton({ onClick, disabled, dataId, className }: {
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly dataId?: string;
  readonly className?: string;
}): ReactElement {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      trailingIcon={<Icon name="zap" size="sm" />}
      collapseLabel
      className={className ? `${styles.generate} ${className}` : styles.generate}
      data-cell-id={dataId}
    >
      {t('cardCreator.action.generateAll')}
    </Button>
  );
}

export interface DestinationSelectSpec {
  readonly label: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly onChange?: (value: string) => void;
  readonly disabled?: boolean;
}

export function DestinationSelects({ first, second }: {
  readonly first: DestinationSelectSpec;
  readonly second: DestinationSelectSpec;
}): ReactElement {
  return (
    <div className={styles.destinationRow}>
      {[first, second].map((spec) => (
        <div key={spec.label} className={styles.destinationCol}>
          <Label className={styles.fieldLabel}>{spec.label}</Label>
          <Select
            value={spec.value}
            options={spec.options.map((o) => ({ value: o.value, label: o.label }))}
            onChange={spec.onChange}
            disabled={spec.disabled}
            aria-label={spec.label}
            menuClassName={styles.menu}
          />
        </div>
      ))}
    </div>
  );
}
