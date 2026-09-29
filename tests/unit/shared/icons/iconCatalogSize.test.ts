import { checkIcon, ICON_CATALOG, ICON_SIZE_PX, type IconRenderProps } from '@/shared/icons';

describe('ICON_CATALOG size normalization', () => {
  it('forces every icon component to render at 18px regardless of the size prop', () => {
    for (const entry of Object.values(ICON_CATALOG)) {
      const render = entry.component as (props: IconRenderProps) => { props: IconRenderProps };
      expect(render({ size: 999 }).props.size).toBe(ICON_SIZE_PX);
    }
  });

  it('rewrites every raw svg width/height to 18px', () => {
    for (const entry of Object.values(ICON_CATALOG)) {
      expect(entry.svg).toContain(`width="${ICON_SIZE_PX}"`);
      expect(entry.svg).toContain(`height="${ICON_SIZE_PX}"`);
    }
  });

  it('exposes normalized raw svg re-exports for non-React DOM', () => {
    expect(checkIcon).toContain(`width="${ICON_SIZE_PX}"`);
    expect(checkIcon).toContain(`height="${ICON_SIZE_PX}"`);
  });
});
