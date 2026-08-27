import { useCallback, useEffect, useId, useState, type SyntheticEvent, type ReactElement } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Box } from '@/shared/ui/Box';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { Heading } from '@/shared/ui/Heading';
import { HStack, VStack } from '@/shared/ui/Stack';
import { InputField } from '@/shared/ui/InputField';
import { Label } from '@/shared/ui/Label';
import { Select } from '@/shared/ui/Select';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/icons/Icon';
import styles from './PatternFormSubmit.module.css';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'vi', label: 'Vietnamese' },
];

const SUBMIT_DELAY_MS = 500;

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

interface FormErrors {
  name?: string;
  language?: string;
}

export function Showcase(): ReactElement {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<FormStatus>('idle');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [touched, setTouched] = useState({ name: false, language: false });
  const nameId = useId();
  const languageId = useId();

  const validate = useCallback((): FormErrors => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Profile name is required';
    if (!language) next.language = 'Language is required';
    return next;
  }, [name, language]);

  useEffect(() => {
    setErrors(validate());
  }, [validate]);

  const focusFirstInvalid = useCallback((nextErrors: FormErrors): void => {
    setTimeout(() => {
      if (nextErrors.name) {
        document.getElementById(nameId)?.focus();
      } else if (nextErrors.language) {
        document.getElementById(languageId)?.focus();
      }
    }, 0);
  }, [nameId, languageId]);

  const handleSubmit = useCallback(
    (e?: SyntheticEvent): void => {
      e?.preventDefault();
      setTouched({ name: true, language: true });
      const nextErrors = validate();
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        focusFirstInvalid(nextErrors);
        return;
      }

      setStatus('submitting');
      setTimeout(() => {
        if (name.toLowerCase().includes('error')) {
          setStatus('error');
        } else {
          setStatus('success');
        }
      }, SUBMIT_DELAY_MS);
    },
    [name, language, validate, focusFirstInvalid],
  );

  const handleDeleteConfirm = useCallback((): void => {
    setIsDeleteOpen(false);
    setName('');
    setLanguage('');
    setTouched({ name: false, language: false });
    setStatus('idle');
  }, []);

  const renderFeedback = (): ReactElement | null => {
    switch (status) {
      case 'success':
        return (
          <VStack gap="4" className={styles.padded}>
            <Alert
              variant="success"
              title="Profile saved"
              description={`Saved "${name}" with language ${LANGUAGE_OPTIONS.find((o) => o.value === language)?.label}.`}
              icon={<Icon name="check" size={20} />}
              role="status"
            />
            <Card className={styles.result}>
              <Text as="p" variant="label">{name}</Text>
              <Text as="p" color="secondary">{LANGUAGE_OPTIONS.find((o) => o.value === language)?.label}</Text>
            </Card>
            <Button
              onClick={() => {
                setName('');
                setLanguage('');
                setTouched({ name: false, language: false });
                setStatus('idle');
              }}
              variant="secondary"
            >
              Create another
            </Button>
          </VStack>
        );
      case 'error':
        return (
          <Box className={styles.padded}>
            <Alert
              variant="error"
              title="Save failed"
              description="Could not save the profile. Check your connection and try again."
              icon={<Icon name="alertCircle" size={20} />}
            />
            <HStack gap="2" className={styles.retry}>
              <Button onClick={() => handleSubmit()} leadingIcon={<Icon name="rotateCcw" size={16} />}>
                Retry
              </Button>
            </HStack>
          </Box>
        );
      default:
        return null;
    }
  };

  const languageError = touched.language ? errors.language : undefined;

  return (
    <VStack gap="6" className={styles.root}>
      <header>
        <Heading level={2} size={3}>Pattern: Form submit</Heading>
        <Text color="secondary" as="p">
          Validation, loading, success, error, and destructive confirmation.
        </Text>
      </header>

      <form onSubmit={handleSubmit} className={styles.form}>
        <VStack gap="4" className={styles.formBody}>
          <InputField
            id={nameId}
            label="Profile name"
            placeholder="e.g. Japanese beginner"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            error={touched.name ? errors.name : undefined}
            required
          />

          <VStack gap="1" className={styles.selectField}>
            <Label htmlFor={languageId} required>
              Language
            </Label>
            <Select
              id={languageId}
              value={language}
              onChange={setLanguage}
              options={LANGUAGE_OPTIONS}
              placeholder="Choose a language"
              aria-label="Language"
              error={!!languageError}
              menuAlign="left"
            />
            {languageError && (
              <span id="language-error" className={styles.errorText} role="alert">
                {languageError}
              </span>
            )}
          </VStack>

          <HStack gap="2" className={styles.actions}>
            <Button type="submit" loading={status === 'submitting'}>
              Save profile
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDeleteOpen(true)}
              disabled={status === 'submitting'}
            >
              Delete
            </Button>
          </HStack>
        </VStack>
      </form>

      <section className={styles.stage} aria-label="Form feedback" aria-live="polite">
        {renderFeedback()}
      </section>

      <Dialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete profile?"
        description="This action cannot be undone."
        footer={
          <HStack gap="2">
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
          </HStack>
        }
        showCloseButton
      />
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Pattern: Form submit',
  description: 'Form validation, loading, success, error, and destructive confirmation composed from existing shared UI components.',
  level: 'pages' as const,
  category: 'Pattern',
  order: 12,
};
