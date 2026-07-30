import { Container } from './Container';
import type { ReactElement } from 'react';

const innerStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--color-muted)',
  borderRadius: 'var(--radius-sm)',
  textAlign: 'center',
};

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <span>maxWidth: sm / md / lg / xl / full</span>
        {(['sm', 'md', 'lg', 'xl', 'full'] as const).map((maxWidth) => (
          <Container key={maxWidth} maxWidth={maxWidth} padding="3" style={{ marginTop: 4 }}>
            <div style={innerStyle}>{maxWidth}</div>
          </Container>
        ))}
      </div>
      <div>
        <span>numeric maxWidth: 500px</span>
        <Container maxWidth={500} padding="3" style={{ marginTop: 4 }}>
          <div style={innerStyle}>500px</div>
        </Container>
      </div>
      <div>
        <span>padding: 2 / 4 / 6 / 8</span>
        {(['2', '4', '6', '8'] as const).map((padding) => (
          <Container key={padding} maxWidth="sm" padding={padding} style={{ marginTop: 4, background: 'var(--color-surface)' }}>
            <div style={innerStyle}>padding {padding}</div>
          </Container>
        ))}
      </div>
      <div>
        <span>center: false (left-aligned)</span>
        <Container maxWidth="sm" padding="3" center={false} style={{ marginTop: 4 }}>
          <div style={innerStyle}>not centered</div>
        </Container>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Container',
  description: 'Page content wrapper with maxWidth constraint and centering. Use to constrain page width.',
  group: 'Layout',
  order: 14,
};
