import { useState, type CSSProperties, type ReactElement } from 'react';
import { SearchableSelect } from './SearchableSelect';
import { Text } from './Text';
import { VStack } from './Stack';

const wrapperStyle: CSSProperties = {
  width: '100%',
  maxWidth: 'min(100%, calc(var(--space-5) * 16))',
};

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
];

export function Showcase(): ReactElement {
  const [value, setValue] = useState('vi');

  return (
    <VStack gap="4" style={wrapperStyle}>
      <Text as="h3" variant="heading-3" color="secondary">Searchable language select</Text>
      <SearchableSelect
        options={LANGUAGES}
        value={value}
        onChange={setValue}
        ariaLabel="Select subtitle language"
        placeholder="Search language..."
      />
      <Text as="h3" variant="heading-3" color="secondary">Disabled</Text>
      <SearchableSelect
        options={LANGUAGES}
        value="en"
        onChange={() => {}}
        ariaLabel="Disabled language select"
        disabled
      />
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Searchable Select',
  description: 'Single-select dropdown with embedded search, disabled state, and keyboard navigation.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  status: 'stable' as const,
  order: 86,
};
