import { useState, type ReactElement } from 'react';
import { CheckboxGroup } from './CheckboxGroup';
import { Text } from './Text';
import { VStack } from './Stack';

const OPTIONS = [
  { value: 'sub', label: 'Tự động tải phụ đề' },
  { value: 'audio', label: 'Tải audio' },
  { value: 'thumb', label: 'Lưu thumbnail', disabled: true },
  { value: 'notify', label: 'Thông báo' },
];

export function Showcase(): ReactElement {
  const [value, setValue] = useState<string[]>(['sub', 'notify']);

  return (
    <VStack gap="4">
      <Text as="h3" variant="heading-3" color="secondary">Multi select</Text>
      <CheckboxGroup
        name="features"
        options={OPTIONS}
        value={value}
        onChange={setValue}
      />
      <Text as="h3" variant="heading-3" color="secondary">Error state</Text>
      <CheckboxGroup
        name="features-error"
        options={OPTIONS}
        value={[]}
        onChange={() => {}}
        error
      />
      <Text as="h3" variant="heading-3" color="secondary">Disabled group</Text>
      <CheckboxGroup
        name="features-disabled"
        options={OPTIONS}
        value={['audio']}
        onChange={() => {}}
        disabled
      />
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Checkbox Group',
  description: 'Managed list of checkboxes with options, disabled items, error state, and controlled multi-selection.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  status: 'stable' as const,
  order: 83,
};
