import { useState, type CSSProperties, type ReactElement } from 'react';
import { SearchField } from './SearchField';
import { Text } from './Text';
import { VStack } from './Stack';

const wrapperStyle: CSSProperties = {
  width: '100%',
  maxWidth: 'min(100%, calc(var(--space-5) * 16))',
};

export function Showcase(): ReactElement {
  const [value, setValue] = useState('phụ đề');
  const [empty, setEmpty] = useState('');

  return (
    <VStack gap="4" style={wrapperStyle}>
      <Text as="h3" variant="heading-3" color="secondary">Tìm kiếm</Text>
      <Text as="p" variant="supporting" color="secondary">SearchField với icon tìm kiếm và nút xóa.</Text>
      <SearchField
        value={value}
        onChange={setValue}
        onClear={() => setValue('')}
        placeholder="Tìm từ vựng..."
      />
      <SearchField
        value={empty}
        onChange={setEmpty}
        placeholder="Trống — chưa có giá trị"
      />
      <SearchField
        value="Không chỉnh được"
        onChange={() => {}}
        disabled
        placeholder="Disabled search"
      />
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Search Field',
  description: 'Search input with a leading search icon and clear button. Supports controlled value, placeholder, and disabled state.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  status: 'stable' as const,
  order: 81,
};
