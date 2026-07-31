import { Flex } from './Flex';
import type { ReactElement } from 'react';

const itemStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: 'var(--color-muted)',
  borderRadius: 'var(--radius-sm)',
};

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>direction: row / column / row-reverse / column-reverse</span>
        {(['row', 'column', 'row-reverse', 'column-reverse'] as const).map((direction) => (
          <Flex key={direction} direction={direction} gap="2">
            <span style={itemStyle}>A</span>
            <span style={itemStyle}>B</span>
            <span style={itemStyle}>C</span>
          </Flex>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>justify: start / center / end / between / around / evenly</span>
        {(['start', 'center', 'end', 'between', 'around', 'evenly'] as const).map((justify) => (
          <Flex key={justify} justify={justify} gap="2">
            <span style={itemStyle}>1</span>
            <span style={itemStyle}>2</span>
            <span style={itemStyle}>3</span>
          </Flex>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>align: start / center / end / stretch / baseline</span>
        {(['start', 'center', 'end', 'stretch', 'baseline'] as const).map((align) => (
          <Flex key={align} align={align} gap="2" style={{ height: 40 }}>
            <span style={itemStyle}>X</span>
            <span style={itemStyle}>Y</span>
          </Flex>
        ))}
      </div>
      <Flex inline gap="2">
        <span style={itemStyle}>inline</span>
        <span style={itemStyle}>flex</span>
      </Flex>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Flex',
  description: 'Flexbox layout primitive with direction, justify, align, and wrap props. Use for flexible layouts.',
  level: 'atoms',
  category: 'Layout',
  group: 'Layout',
  order: 11,
};
