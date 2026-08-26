import { useState, type ReactElement } from 'react';
import { RadioGroup } from './RadioGroup';
import { Text } from './Text';
import { VStack } from './Stack';

const OPTIONS = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'auto', label: 'Tự động', disabled: true },
];

export function Showcase(): ReactElement {
  const [value, setValue] = useState('light');

  return (
    <VStack gap="4">
      <Text as="h3" variant="heading-3" color="secondary">Single select</Text>
      <RadioGroup name="theme" options={OPTIONS} value={value} onChange={setValue} />
      <Text as="h3" variant="heading-3" color="secondary">Error state</Text>
      <RadioGroup name="theme-error" options={OPTIONS} value="" onChange={() => {}} error />
      <Text as="h3" variant="heading-3" color="secondary">Disabled</Text>
      <RadioGroup name="theme-disabled" options={OPTIONS} value="dark" onChange={() => {}} disabled />
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Radio Group',
  description: 'Managed list of radio buttons with options, disabled items, error state, and controlled single-selection.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  status: 'stable' as const,
  order: 84,
};
