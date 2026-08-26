import { useState, type CSSProperties, type ReactElement } from 'react';
import { InputField } from './InputField';
import { Text } from './Text';
import { VStack } from './Stack';

const wrapperStyle: CSSProperties = {
  width: '100%',
  maxWidth: 'min(100%, calc(var(--space-5) * 16))',
};

export function Showcase(): ReactElement {
  const [value, setValue] = useState('');
  const [errorValue, setErrorValue] = useState('khong-phai-email');
  const [requiredValue, setRequiredValue] = useState('');

  return (
    <VStack gap="4" style={wrapperStyle}>
      <Text as="h3" variant="heading-3" color="secondary">Form field</Text>
      <InputField
        label="Email"
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        helperText="Nhập email để nhận thông báo."
        placeholder="you@example.com"
      />
      <InputField
        label="Tên hiển thị"
        value={requiredValue}
        onChange={(e) => setRequiredValue(e.target.value)}
        placeholder="Tên của bạn"
        required
      />
      <InputField
        label="Email"
        value={errorValue}
        onChange={(e) => setErrorValue(e.target.value)}
        error="Email không hợp lệ"
        placeholder="khong-phai-email"
      />
      <InputField
        label="Ghi chú"
        value="Không chỉnh được"
        onChange={() => {}}
        disabled
      />
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Input Field',
  description: 'Label + input + helper/error text molecule. Supports required, disabled, and validation states.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  status: 'stable' as const,
  order: 82,
};
