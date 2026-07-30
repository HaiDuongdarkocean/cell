import { VStack, HStack } from './Stack';
import type { ReactElement } from 'react';

const itemStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: 'var(--color-muted)',
  borderRadius: 'var(--radius-sm)',
};

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <span>VStack — vertical, gap: 2 / 4 / 6</span>
        {(['2', '4', '6'] as const).map((gap) => (
          <VStack key={gap} gap={gap} style={{ marginTop: 4 }}>
            <span style={itemStyle}>A</span>
            <span style={itemStyle}>B</span>
            <span style={itemStyle}>C</span>
          </VStack>
        ))}
      </div>
      <div>
        <span>HStack — horizontal, gap: 2 / 4 / 6</span>
        {(['2', '4', '6'] as const).map((gap) => (
          <HStack key={gap} gap={gap} style={{ marginTop: 4 }}>
            <span style={itemStyle}>A</span>
            <span style={itemStyle}>B</span>
            <span style={itemStyle}>C</span>
          </HStack>
        ))}
      </div>
      <div>
        <span>VStack align: start / center / end / stretch</span>
        {(['start', 'center', 'end', 'stretch'] as const).map((align) => (
          <VStack key={align} align={align} gap="2" style={{ marginTop: 4 }}>
            <span style={itemStyle}>{align}</span>
            <span style={itemStyle}>item</span>
          </VStack>
        ))}
      </div>
      <div>
        <span>HStack justify: start / center / end / between</span>
        {(['start', 'center', 'end', 'between'] as const).map((justify) => (
          <HStack key={justify} justify={justify} gap="2" style={{ marginTop: 4 }}>
            <span style={itemStyle}>{justify}</span>
            <span style={itemStyle}>item</span>
          </HStack>
        ))}
      </div>
      <div>
        <span>VStack with divider</span>
        <VStack divider gap="2" style={{ marginTop: 4 }}>
          <span style={itemStyle}>First</span>
          <span style={itemStyle}>Second</span>
          <span style={itemStyle}>Third</span>
        </VStack>
      </div>
      <div>
        <span>HStack with divider</span>
        <HStack divider gap="2" style={{ marginTop: 4 }}>
          <span style={itemStyle}>First</span>
          <span style={itemStyle}>Second</span>
          <span style={itemStyle}>Third</span>
        </HStack>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Stack',
  description: 'Stack layout primitive (VStack/HStack) with gap and divider. Use for vertical/horizontal stacking.',
  group: 'Layout',
  order: 13,
};
