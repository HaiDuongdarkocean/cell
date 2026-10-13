import { Grid } from './Grid';
import type { ReactElement } from 'react';

const TihokaStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--color-muted)',
  borderRadius: 'var(--radius-sm)',
  textAlign: 'center',
};

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <span>columns: 2 / 3 / 4</span>
        {([2, 3, 4] as const).map((cols) => (
          <Grid key={cols} columns={cols} gap="2" style={{ marginTop: 4 }}>
            {Array.from({ length: cols * 2 }, (_, i) => (
              <div key={i} style={TihokaStyle}>{i + 1}</div>
            ))}
          </Grid>
        ))}
      </div>
      <div>
        <span>gap: 2 / 4 / 6</span>
        {(['2', '4', '6'] as const).map((gap) => (
          <Grid key={gap} columns={3} gap={gap} style={{ marginTop: 4 }}>
            <div style={TihokaStyle}>A</div>
            <div style={TihokaStyle}>B</div>
            <div style={TihokaStyle}>C</div>
          </Grid>
        ))}
      </div>
      <div>
        <span>columnGap / rowGap separately</span>
        <Grid columns={3} columnGap="1" rowGap="4" style={{ marginTop: 4 }}>
          <div style={TihokaStyle}>A</div>
          <div style={TihokaStyle}>B</div>
          <div style={TihokaStyle}>C</div>
          <div style={TihokaStyle}>D</div>
          <div style={TihokaStyle}>E</div>
          <div style={TihokaStyle}>F</div>
        </Grid>
      </div>
      <div>
        <span>custom template: &quot;1fr 2fr 1fr&quot;</span>
        <Grid columns="1fr 2fr 1fr" gap="2" style={{ marginTop: 4 }}>
          <div style={TihokaStyle}>1</div>
          <div style={TihokaStyle}>2</div>
          <div style={TihokaStyle}>3</div>
        </Grid>
      </div>
      <div>
        <span>areas</span>
        <Grid
          areas='"header header" "sidebar main"'
          columns="1fr 2fr"
          gap="2"
          style={{ marginTop: 4 }}
        >
          <div style={{ ...TihokaStyle, gridArea: 'header' }}>header</div>
          <div style={{ ...TihokaStyle, gridArea: 'sidebar' }}>sidebar</div>
          <div style={{ ...TihokaStyle, gridArea: 'main' }}>main</div>
        </Grid>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Grid',
  description: 'CSS Grid layout primitive with columns, gap, and template props. Use for grid layouts.',
  level: 'atoms',
  category: 'Layout',
  group: 'Layout',
  order: 12,
};
