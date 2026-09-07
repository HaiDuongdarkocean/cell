import { Icon } from '@/shared/ui/Icon';
import { HintIcon } from '@/shared/ui/HintIcon';
import { SectionFrame, FieldSelect, type PanelProps } from './common';
import {
  FIELD_DEFS,
  TILE_DEFS,
  fieldValueLabel,
  type TileDef,
} from './mockData';
import styles from './mockup.module.css';

interface TileProps extends PanelProps {
  def: TileDef;
}

function Tile({ def, settings, onChange }: TileProps): React.ReactElement {
  const field = FIELD_DEFS[def.key];
  const hint = field.hint?.(settings);
  return (
    <div className={styles.mksTile} data-accent={def.accent}>
      <div className={styles.mksTileTop}>
        <span className={styles.mksTileIcon}>
          <Icon name={def.icon} size="sm" />
        </span>
        <span className={styles.mksTileText}>
          <span className={styles.mksTileLabel}>
            {field.label}
            {hint && <HintIcon hint={hint} ariaLabel={`Show hint for ${field.label}`} />}
          </span>
          <span className={styles.mksTileValue}>{fieldValueLabel(def.key, settings)}</span>
        </span>
      </div>
      <p className={styles.mksTileBlurb}>{def.blurb}</p>
      <FieldSelect
        id={`mks-b-${def.key}`}
        field={def.key}
        settings={settings}
        onChange={onChange}
      />
    </div>
  );
}

/**
 * Concept B — Nature Dashboard Tiles.
 *
 * Every setting is a glass tile tinted with a nature accent (sky blue, leaf
 * green, sunlight amber, pebble gray), carrying an icon, the current value,
 * and the select. One column on mobile, 2–3 columns on desktop. More visual
 * density, but still quiet.
 */
export function ConceptB({ settings, onChange }: PanelProps): React.ReactElement {
  const showWorkers = settings.parallelConversion === 'manual';
  return (
    <SectionFrame>
      <div className={styles.mksTileGrid}>
        {TILE_DEFS.map((def) => (
          <Tile key={def.key} def={def} settings={settings} onChange={onChange} />
        ))}
        {showWorkers && (
          <Tile
            def={{
              key: 'manualWorkerCount',
              icon: 'slidersHorizontal',
              accent: 'sun',
              blurb: 'Worker threads for manual parallel mode.',
            }}
            settings={settings}
            onChange={onChange}
          />
        )}
      </div>
    </SectionFrame>
  );
}
