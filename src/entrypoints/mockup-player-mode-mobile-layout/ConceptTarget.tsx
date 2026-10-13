import { useCallback, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Menu, MenuItem, MenuSeparator } from '@/shared/ui/Menu';
import { Icon } from '@/shared/icons/Icon';
import { MOCK_CUES, fmtCueTime } from './mockData';
import styles from './mockup.module.css';

function CueCard({ cue, active }: { cue: (typeof MOCK_CUES)[number]; active?: boolean }): React.ReactElement {
  return (
    <article className={`${styles.cueCard} ${active ? styles.cueCardActive : styles.cueCardMuted}`}>
      <p className={styles.cueTarget}>{cue.targetText}</p>
      <p className={styles.cueNative}>{cue.nativeText}</p>
      <footer className={styles.cueFooter}>
        <span className={styles.cueTime}>
          {fmtCueTime(cue.start)} – {fmtCueTime(cue.end)}
        </span>
        <span className={styles.cueFooterIcons}>
          <Icon name="pin" aria-hidden="true" />
          <Icon name="layers" aria-hidden="true" />
        </span>
      </footer>
      {active && (
        <div className={styles.cardRail} data-tihoka-id="pm-card-actions">
          <Button variant="primarySubtle" size="md" elevation="low" aria-label="Quick add" data-tihoka-id="quick-add-btn">
            <Icon name="zap" />
          </Button>
          <Button variant="errorSubtle" size="md" elevation="low" aria-label="Send to Card Creator" data-tihoka-id="edit-card-btn">
            <Icon name="pencil" />
          </Button>
        </div>
      )}
    </article>
  );
}

export function ConceptTarget(): React.ReactElement {
  const [playing, setPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback((): void => setMenuOpen(false), []);
  return (
    <div className={styles.pmFrame}>
      <div className={styles.pmVideo}>
        <Icon name="video" aria-hidden="true" />
      </div>
      <div className={styles.pmCueWrap}>
        <div className={styles.pmCueRegion}>
          <div className={styles.pmCards}>
            <CueCard cue={MOCK_CUES[1]} />
            <CueCard cue={MOCK_CUES[2]} active />
            <CueCard cue={MOCK_CUES[3]} />
            <CueCard cue={MOCK_CUES[4]} />
          </div>
        </div>
        <div className={styles.pmAnchorBand}>
          <div className={styles.pmAnchorRow}>
            <Button variant="neutralSubtle" size="lg" aria-label="Subtitle Manager" data-tihoka-id="manager-toggle-btn">
              <Icon name="captions" />
            </Button>
            <span className={styles.pmPill} data-tihoka-id="comprehension-pill">
              <span className={styles.pmPillDot} /> Excellent 96%
            </span>
            <div className={styles.pmRail} data-tihoka-id="player-mode-actions">
              <Button variant="neutralSubtle" size="lg" elevation="low" aria-label="Filter cues" data-tihoka-id="cue-filter-fab" className={styles.pmRailFab}>
                <Icon name="slidersHorizontal" />
              </Button>
              <Button variant="neutralSubtle" size="lg" elevation="low" aria-label="Generate subtitle" data-tihoka-id="generate-native-btn">
                <Icon name="generateNative" />
              </Button>
            </div>
          </div>
          <p className={styles.pmCaption}>Subtitles: English (United States)</p>
        </div>
      </div>
      <nav className={styles.pmBottomBar} data-tihoka-id="pm-bottom-bar" aria-label="Player controls">
        <Button variant="ghost" size="md" aria-label="Exit Player Mode" data-tihoka-id="player-mode-exit-btn">
          <Icon name="x" />
        </Button>
        <div className={styles.barTransport} data-tihoka-id="nav-cluster">
          <Button variant="primarySubtle" size="lg" aria-label="Previous cue" data-tihoka-id="nav-prev">
            <Icon name="chevronLeft" />
          </Button>
          <Button variant="primarySubtle" size="lg" aria-label="Repeat cue" data-tihoka-id="nav-repeat">
            <Icon name="rotateCcw" />
          </Button>
          <Button
            variant="warningSubtle"
            size="xl"
            elevation="low"
            className={styles.barHero}
            aria-label={playing ? 'Pause' : 'Play'}
            data-tihoka-id="nav-play"
            onClick={() => setPlaying((p) => !p)}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </Button>
          <Button variant="primarySubtle" size="lg" aria-label="Next cue" data-tihoka-id="nav-next">
            <Icon name="chevronRight" />
          </Button>
        </div>
        <Button
          ref={moreRef}
          variant="ghost"
          size="md"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-tihoka-id="pm-more-btn"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Icon name="ellipsis" />
        </Button>
        <Menu open={menuOpen} onClose={closeMenu} triggerRef={moreRef} align="right" ariaLabel="More actions">
          <MenuItem onSelect={closeMenu}>
            <Icon name="sidePanel" aria-hidden="true" /> Hide cue list
          </MenuItem>
          <MenuItem onSelect={closeMenu}>
            <Icon name="scanText" aria-hidden="true" /> OCR subtitles
          </MenuItem>
          <MenuSeparator />
          <MenuItem radio selected onSelect={closeMenu}>
            <Icon name="captions" aria-hidden="true" /> Follow mode
          </MenuItem>
          <MenuItem radio onSelect={closeMenu}>
            <Icon name="bookOpen" aria-hidden="true" /> Word study
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={closeMenu}>
            <Icon name="gauge" aria-hidden="true" /> Speed 1.0×
          </MenuItem>
        </Menu>
      </nav>
    </div>
  );
}
