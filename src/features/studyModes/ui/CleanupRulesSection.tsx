import { useState, type ReactElement } from 'react';
import { Button, Code, Dialog, FormGroup, Icon, Input, Text, Toggle, VStack } from '@/shared/ui';
import { t } from '@/shared/i18n';
import type { CleanupRulesSetting, SubtitleCleanupRule } from '@/entities/studyMode';
import { MAX_CUSTOM_RULES, resolveCleanupRules } from '@/entities/studyMode';
import {
  addCleanupRule,
  deleteCleanupRule,
  toggleCleanupRule,
  updateCleanupRule,
  validateCleanupRuleDraft,
  type CleanupRuleDraft,
  type CleanupRuleErrors,
} from '../lib/cleanupRuleOps';
import { cleanupT } from '../lib/cleanupRuleMessages';
import styles from './StudyModesTab.module.css';

const EMPTY_DRAFT: CleanupRuleDraft = { name: '', description: '', pattern: '' };

interface CleanupRulesSectionProps {
  readonly setting: CleanupRulesSetting;
  readonly onChange: (setting: CleanupRulesSetting) => void;
}

export function CleanupRulesSection({ setting, onChange }: CleanupRulesSectionProps): ReactElement {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CleanupRuleDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const rules = resolveCleanupRules(setting);
  const customs = setting.custom;
  const builtins = rules.filter((rule) => rule.builtin);
  const deleting = customs.find((rule) => rule.id === deleteId);
  const atLimit = customs.length >= MAX_CUSTOM_RULES;

  const openAdd = (): void => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setTouched(false);
    setEditorOpen(true);
  };

  const openEdit = (rule: SubtitleCleanupRule): void => {
    setEditingId(rule.id);
    setDraft({ name: rule.name, description: rule.description, pattern: rule.pattern });
    setTouched(false);
    setEditorOpen(true);
  };

  const errors: CleanupRuleErrors = validateCleanupRuleDraft(setting, draft, editingId ?? undefined);
  const shownErrors: CleanupRuleErrors = touched ? errors : {};

  const handleSave = (): void => {
    const result = editingId
      ? updateCleanupRule(setting, editingId, draft)
      : addCleanupRule(setting, draft);
    if (result.errors) {
      setTouched(true);
      return;
    }
    onChange(result.setting);
    setEditorOpen(false);
  };

  const handleDelete = (): void => {
    if (deleteId) onChange(deleteCleanupRule(setting, deleteId));
    setDeleteId(null);
  };

  const handleToggle = (rule: SubtitleCleanupRule): void => {
    onChange(toggleCleanupRule(setting, rule));
  };

  const ruleRow = (rule: SubtitleCleanupRule): ReactElement => (
    <div className={styles.ruleRow} key={rule.id}>
      <Toggle
        checked={rule.enabled}
        onChange={() => handleToggle(rule)}
        ariaLabel={cleanupT('cleanup.enableRule', [rule.name])}
      />
      <div className={styles.ruleBody}>
        <div className={styles.ruleNameRow}>
          <span className={styles.ruleName}>{rule.name}</span>
          {rule.builtin && <span className={styles.builtinTag}>{cleanupT('cleanup.builtinTag')}</span>}
        </div>
        {rule.description && <span className={styles.ruleDesc}>{rule.description}</span>}
        <Code className={styles.rulePattern} title={rule.pattern}>
          {rule.pattern}
        </Code>
      </div>
      {!rule.builtin && (
        <div className={styles.ruleActions}>
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Icon name="pencil" size="xs" />}
            onClick={() => openEdit(rule)}
            data-cell-id={`edit-rule-${rule.id}`}
          >
            {t('settings.profiles.menu.edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Icon name="trash" size="xs" />}
            onClick={() => setDeleteId(rule.id)}
            data-cell-id={`delete-rule-${rule.id}`}
          >
            {t('settings.profiles.menu.delete')}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className={styles.groupHeader}>
        <div className={styles.groupText}>
          <Text as="p" className={styles.advancedLabel}>
            {cleanupT('cleanup.title')}
          </Text>
          <Text color="secondary" as="p" className={styles.ruleDesc}>
            {cleanupT('cleanup.subtitle')}
          </Text>
        </div>
        <Button
          size="sm"
          leadingIcon={<Icon name="plus" size="xs" />}
          onClick={openAdd}
          className={styles.addButton}
          disabled={atLimit}
          data-cell-id="add-cleanup-rule"
        >
          {cleanupT('cleanup.addRule')}
        </Button>
      </div>
      <div className={styles.rulesList} role="group" aria-label={cleanupT('cleanup.rulesGroup')}>
        {builtins.map(ruleRow)}
        {customs.length > 0 && <div className={styles.customsDivider}>{cleanupT('cleanup.customDivider')}</div>}
        {customs.map(ruleRow)}
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={editingId ? cleanupT('cleanup.editDialog.title') : cleanupT('cleanup.addDialog.title')}
        data-cell-id="cleanup-rule-editor"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)} data-cell-id="cleanup-rule-cancel">
              {t('settings.profiles.form.cancel')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={Boolean(errors.name || errors.pattern)} data-cell-id="cleanup-rule-save">
              {t('settings.profiles.form.save')}
            </Button>
          </>
        }
      >
        <VStack gap="3">
          <FormGroup label={cleanupT('cleanup.field.name')} required htmlFor="cleanup-rule-name">
            <Input
              id="cleanup-rule-name"
              value={draft.name}
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value });
                setTouched(true);
              }}
              placeholder={cleanupT('cleanup.field.namePlaceholder')}
              error={Boolean(shownErrors.name)}
              errorMessage={shownErrors.name}
              data-cell-id="cleanup-rule-name"
            />
          </FormGroup>
          <FormGroup label={cleanupT('cleanup.field.description')} htmlFor="cleanup-rule-desc">
            <Input
              id="cleanup-rule-desc"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder={cleanupT('cleanup.field.descPlaceholder')}
              data-cell-id="cleanup-rule-desc"
            />
          </FormGroup>
          <FormGroup label={cleanupT('cleanup.field.pattern')} required htmlFor="cleanup-rule-pattern">
            <Input
              id="cleanup-rule-pattern"
              value={draft.pattern}
              onChange={(e) => {
                setDraft({ ...draft, pattern: e.target.value });
                setTouched(true);
              }}
              placeholder={cleanupT('cleanup.field.patternPlaceholder')}
              error={Boolean(shownErrors.pattern)}
              errorMessage={shownErrors.pattern}
              data-cell-id="cleanup-rule-pattern"
            />
          </FormGroup>
        </VStack>
      </Dialog>

      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title={cleanupT('cleanup.deleteDialog.title')}
        description={deleting ? cleanupT('cleanup.deleteDialog.description', [deleting.name]) : undefined}
        data-cell-id="cleanup-rule-delete-dialog"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)} data-cell-id="cleanup-rule-delete-cancel">
              {t('settings.profiles.form.cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} data-cell-id="cleanup-rule-delete-ok">
              {t('settings.profiles.menu.delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}
