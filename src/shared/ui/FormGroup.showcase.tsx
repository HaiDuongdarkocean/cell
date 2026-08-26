import { useId, useState, type CSSProperties, type ReactElement } from 'react';
import { FormGroup } from './FormGroup';
import { Input } from './Input';
import { Text } from './Text';
import { VStack } from './Stack';

const wrapperStyle: CSSProperties = {
  width: '100%',
  maxWidth: 'min(100%, calc(var(--space-5) * 16))',
};

export function Showcase(): ReactElement {
  const id = useId();
  const noteId = `${id}-note`;
  const [value, setValue] = useState('');

  return (
    <VStack gap="4" style={wrapperStyle}>
      <Text as="h3" variant="heading-3" color="secondary">Label + input</Text>
      <FormGroup label="Tên hiển thị" htmlFor={id} required>
        <Input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Nhập tên"
        />
      </FormGroup>
      <FormGroup label="Ghi chú" htmlFor={noteId} disabled>
        <Input
          id={noteId}
          value="Không chỉnh được"
          onChange={() => {}}
          disabled
        />
      </FormGroup>
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Form Group',
  description: 'Wraps a label and a form control with consistent spacing, required indicator, and disabled styling.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  status: 'stable' as const,
  order: 88,
};
