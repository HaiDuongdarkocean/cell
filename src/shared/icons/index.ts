// SVG icon registry — single source of truth for icons in the codebase.
//
// Workflow (AGENTS.md): icon task → query ICON_CATALOG first → reuse or add new.
// Do NOT search the web before checking this catalog. Do NOT inline SVG in
// components — import from here so the catalog stays complete.
//
// Convention: 24×24, stroke 1.5, currentColor, round caps, round joins.
// - Grid: 24×24px canvas with 2px padding (20×20px live area)
// - Stroke: 1.5px unified across all icons (minimalist, dense UI)
// - Caps/Joins: Round for friendly, approachable feel
// - Color: currentColor (inherits from text color)
// - Fill: none (outline style) unless explicitly filled (e.g., play icon)
//
// Add new icon:
//   1. Drop .svg into ./svg/ with stroke-width="1.5"
//   2. Re-export raw string below
//   3. Add entry to ICON_CATALOG with semantic tags + source
//   4. Component imports from ICON_CATALOG, not the .svg?raw directly

// === Original 4 icons ===
import settingsSvg from './svg/settings.svg?raw';
import pencilSvg from './svg/pencil.svg?raw';
import zapSvg from './svg/zap.svg?raw';
import resizeSvg from './svg/resize.svg?raw';

// === Popup dictionary toolbar (5 tabs) ===
import audioWaveSvg from './svg/audio-wave.svg?raw';
import imageSvg from './svg/image.svg?raw';
import languagesSvg from './svg/languages.svg?raw';
import linkSvg from './svg/link.svg?raw';

// === None / hide panel variants (popup toolbar) ===
import eyeOffSvg from './svg/eye-off.svg?raw';
import chevronDownSvg from './svg/chevron-down.svg?raw';
import panelBottomCloseSvg from './svg/panel-bottom-close.svg?raw';

// === General UI icons ===
import xSvg from './svg/x.svg?raw';
import downloadSvg from './svg/download.svg?raw';
import searchSvg from './svg/search.svg?raw';
import loaderSvg from './svg/loader.svg?raw';
import playSvg from './svg/play.svg?raw';
import pauseSvg from './svg/pause.svg?raw';
import plusSvg from './svg/plus.svg?raw';
import minusSvg from './svg/minus.svg?raw';
import checkSvg from './svg/check.svg?raw';
import infoSvg from './svg/info.svg?raw';
import alertCircleSvg from './svg/alert-circle.svg?raw';
import moonSvg from './svg/moon.svg?raw';
import sunSvg from './svg/sun.svg?raw';
import powerSvg from './svg/power.svg?raw';
import trashSvg from './svg/trash.svg?raw';
import copySvg from './svg/copy.svg?raw';
import clockSvg from './svg/clock.svg?raw';
import menuSvg from './svg/menu.svg?raw';
import ellipsisVerticalSvg from './svg/ellipsis-vertical.svg?raw';
import videoSvg from './svg/video.svg?raw';
import flagSvg from './svg/flag.svg?raw';
import rotateCcwSvg from './svg/rotate-ccw.svg?raw';
import panelRightSvg from './svg/panel-right.svg?raw';
import chevronLeftSvg from './svg/chevron-left.svg?raw';
import chevronRightSvg from './svg/chevron-right.svg?raw';
import repeatSvg from './svg/repeat.svg?raw';
import triangleAlertSvg from './svg/triangle-alert.svg?raw';
import circleCheckSvg from './svg/circle-check.svg?raw';
import circleXSvg from './svg/circle-x.svg?raw';
import circleInfoSvg from './svg/circle-info.svg?raw';
import messageSquareSvg from './svg/message-square.svg?raw';
import bookOpenSvg from './svg/book-open.svg?raw';

// === Media / window control icons ===
import externalLinkSvg from './svg/external-link.svg?raw';
import checkDoubleSvg from './svg/check-double.svg?raw';
import wrenchSvg from './svg/wrench.svg?raw';
import microphoneSvg from './svg/microphone.svg?raw';
import volumeHighSvg from './svg/volume-high.svg?raw';
import volumeLowSvg from './svg/volume-low.svg?raw';
import volumeMuteSvg from './svg/volume-mute.svg?raw';
import captionsSvg from './svg/captions.svg?raw';
import maximizeSvg from './svg/maximize.svg?raw';
import minimizeSvg from './svg/minimize.svg?raw';
import pipSvg from './svg/pip.svg?raw';
import pinSvg from './svg/pin.svg?raw';
import pinOffSvg from './svg/pin-off.svg?raw';

// === Design system showcase — atomic design level icons ===
import layersSvg from './svg/layers.svg?raw';
import atomSvg from './svg/atom.svg?raw';
import moleculeSvg from './svg/molecule.svg?raw';
import organismSvg from './svg/organism.svg?raw';
import wireframeSvg from './svg/wireframe.svg?raw';
import windowPageSvg from './svg/window-page.svg?raw';

// === Nav cluster icons ===
import navPrevSvg from './svg/nav-prev.svg?raw';
import navNextSvg from './svg/nav-next.svg?raw';
import navRepeatSvg from './svg/nav-repeat.svg?raw';
import navRepeatASvg from './svg/nav-repeat-a.svg?raw';
import navRepeatBSvg from './svg/nav-repeat-b.svg?raw';
import navRepeatCancelSvg from './svg/nav-repeat-cancel.svg?raw';
import navRewindSvg from './svg/nav-rewind.svg?raw';
import navForwardSvg from './svg/nav-forward.svg?raw';
import navPlaySvg from './svg/nav-play.svg?raw';
import navPauseSvg from './svg/nav-pause.svg?raw';

// === Subtitle overlay icons ===
import generateNativeSvg from './svg/generate-native.svg?raw';
import sidePanelSvg from './svg/side-panel.svg?raw';
import subtitleManagerSvg from './svg/subtitle-manager.svg?raw';
import resetOffsetSvg from './svg/reset-offset.svg?raw';
import slidersHorizontalSvg from './svg/sliders-horizontal.svg?raw';

// Re-export individual icons for backward compat (existing imports).
export { default as settingsIcon } from './svg/settings.svg?raw';
export { default as pencilIcon } from './svg/pencil.svg?raw';
export { default as zapIcon } from './svg/zap.svg?raw';
export { default as resizeIcon } from './svg/resize.svg?raw';
export { default as audioWaveIcon } from './svg/audio-wave.svg?raw';
export { default as imageIcon } from './svg/image.svg?raw';
export { default as languagesIcon } from './svg/languages.svg?raw';
export { default as linkIcon } from './svg/link.svg?raw';
export { default as eyeOffIcon } from './svg/eye-off.svg?raw';
export { default as chevronDownIcon } from './svg/chevron-down.svg?raw';
export { default as panelBottomCloseIcon } from './svg/panel-bottom-close.svg?raw';
export { default as xIcon } from './svg/x.svg?raw';
export { default as downloadIcon } from './svg/download.svg?raw';
export { default as searchIcon } from './svg/search.svg?raw';
export { default as loaderIcon } from './svg/loader.svg?raw';
export { default as playIcon } from './svg/play.svg?raw';
export { default as pauseIcon } from './svg/pause.svg?raw';
export { default as plusIcon } from './svg/plus.svg?raw';
export { default as minusIcon } from './svg/minus.svg?raw';
export { default as checkIcon } from './svg/check.svg?raw';
export { default as infoIcon } from './svg/info.svg?raw';
export { default as alertCircleIcon } from './svg/alert-circle.svg?raw';
export { default as moonIcon } from './svg/moon.svg?raw';
export { default as sunIcon } from './svg/sun.svg?raw';
export { default as powerIcon } from './svg/power.svg?raw';
export { default as trashIcon } from './svg/trash.svg?raw';
export { default as copyIcon } from './svg/copy.svg?raw';
export { default as clockIcon } from './svg/clock.svg?raw';
export { default as menuIcon } from './svg/menu.svg?raw';
export { default as ellipsisVerticalIcon } from './svg/ellipsis-vertical.svg?raw';
export { default as videoIcon } from './svg/video.svg?raw';
export { default as flagIcon } from './svg/flag.svg?raw';
export { default as rotateCcwIcon } from './svg/rotate-ccw.svg?raw';
export { default as panelRightIcon } from './svg/panel-right.svg?raw';
export { default as chevronLeftIcon } from './svg/chevron-left.svg?raw';
export { default as chevronRightIcon } from './svg/chevron-right.svg?raw';
export { default as repeatIcon } from './svg/repeat.svg?raw';
export { default as triangleAlertIcon } from './svg/triangle-alert.svg?raw';
export { default as circleCheckIcon } from './svg/circle-check.svg?raw';
export { default as circleXIcon } from './svg/circle-x.svg?raw';
export { default as circleInfoIcon } from './svg/circle-info.svg?raw';
export { default as messageSquareIcon } from './svg/message-square.svg?raw';
export { default as bookOpenIcon } from './svg/book-open.svg?raw';
export { default as navPrevIcon } from './svg/nav-prev.svg?raw';
export { default as navNextIcon } from './svg/nav-next.svg?raw';
export { default as navRepeatIcon } from './svg/nav-repeat.svg?raw';
export { default as navRepeatAIcon } from './svg/nav-repeat-a.svg?raw';
export { default as navRepeatBIcon } from './svg/nav-repeat-b.svg?raw';
export { default as navRepeatCancelIcon } from './svg/nav-repeat-cancel.svg?raw';
export { default as navRewindIcon } from './svg/nav-rewind.svg?raw';
export { default as navForwardIcon } from './svg/nav-forward.svg?raw';
export { default as navPlayIcon } from './svg/nav-play.svg?raw';
export { default as navPauseIcon } from './svg/nav-pause.svg?raw';
export { default as generateNativeIcon } from './svg/generate-native.svg?raw';
export { default as sidePanelIcon } from './svg/side-panel.svg?raw';
export { default as subtitleManagerIcon } from './svg/subtitle-manager.svg?raw';
export { default as resetOffsetIcon } from './svg/reset-offset.svg?raw';
export { default as externalLinkIcon } from './svg/external-link.svg?raw';
export { default as checkDoubleIcon } from './svg/check-double.svg?raw';
export { default as wrenchIcon } from './svg/wrench.svg?raw';
export { default as microphoneIcon } from './svg/microphone.svg?raw';
export { default as volumeHighIcon } from './svg/volume-high.svg?raw';
export { default as volumeLowIcon } from './svg/volume-low.svg?raw';
export { default as volumeMuteIcon } from './svg/volume-mute.svg?raw';
export { default as captionsIcon } from './svg/captions.svg?raw';
export { default as maximizeIcon } from './svg/maximize.svg?raw';
export { default as minimizeIcon } from './svg/minimize.svg?raw';
export { default as pipIcon } from './svg/pip.svg?raw';
export { default as pinIcon } from './svg/pin.svg?raw';
export { default as pinOffIcon } from './svg/pin-off.svg?raw';
export { default as layersIcon } from './svg/layers.svg?raw';
export { default as atomIcon } from './svg/atom.svg?raw';
export { default as moleculeIcon } from './svg/molecule.svg?raw';
export { default as organismIcon } from './svg/organism.svg?raw';
export { default as wireframeIcon } from './svg/wireframe.svg?raw';
export { default as windowPageIcon } from './svg/window-page.svg?raw';

/** Semantic icon entry — query by tags to find reuse candidates. */
export interface IconEntry {
  /** Raw SVG markup string (inject via innerHTML). */
  readonly svg: string;
  /** Lucide icon name or custom source label. */
  readonly source: string;
  /** Semantic tags for discovery (lowercase). */
  readonly tags: readonly string[];
}

/**
 * ICON_CATALOG — query this before creating a new icon.
 * Key = stable semantic id. Tags enable fuzzy discovery.
 *
 * Usage:
 *   import { ICON_CATALOG } from '@/shared/icons';
 *   const audio = ICON_CATALOG.audioWave.svg;
 *
 *   // Or search by tag:
 *   const hide = Object.values(ICON_CATALOG).find(e => e.tags.includes('hide'));
 */
export const ICON_CATALOG = {
  // === Action icons ===
  settings:    { svg: settingsSvg,    source: 'lucide/settings',    tags: ['settings','gear','config','preferences'] } as IconEntry,
  pencil:      { svg: pencilSvg,      source: 'lucide/pencil',      tags: ['edit','write','pencil','modify'] } as IconEntry,
  zap:         { svg: zapSvg,         source: 'lucide/zap',         tags: ['quick','fast','lightning','bolt','instant'] } as IconEntry,
  resize:      { svg: resizeSvg,      source: 'custom/resize',      tags: ['resize','drag','handle','diagonal'] } as IconEntry,

  // === Popup dictionary toolbar ===
  audioWave:   { svg: audioWaveSvg,   source: 'cardCreator/MediaList ThumbIcon', tags: ['audio','waveform','sound','voice','tts','play-audio'] } as IconEntry,
  image:       { svg: imageSvg,       source: 'lucide/image',       tags: ['image','picture','photo','gallery'] } as IconEntry,
  languages:   { svg: languagesSvg,   source: 'lucide/languages',   tags: ['translate','languages','i18n','localize'] } as IconEntry,
  link:        { svg: linkSvg,        source: 'lucide/link',        tags: ['link','chain','url','external','hyperlink'] } as IconEntry,

  // === None / hide panel variants ===
  eyeOff:           { svg: eyeOffSvg,           source: 'lucide/eye-off',            tags: ['hide','eye-off','invisible','none','conceal'] } as IconEntry,
  chevronDown:      { svg: chevronDownSvg,      source: 'lucide/chevron-down',       tags: ['collapse','chevron','down','arrow-down','fold','dropdown','expand'] } as IconEntry,
  panelBottomClose: { svg: panelBottomCloseSvg, source: 'lucide/panel-bottom-close', tags: ['panel','hide','close','bottom','collapse-panel'] } as IconEntry,

  // === General UI ===
  x:           { svg: xSvg,           source: 'lucide/x',           tags: ['close','dismiss','cancel','x','clear'] } as IconEntry,
  download:    { svg: downloadSvg,    source: 'lucide/download',    tags: ['download','save','arrow-down-tray'] } as IconEntry,
  search:      { svg: searchSvg,      source: 'lucide/search',      tags: ['search','magnifier','find','lookup'] } as IconEntry,
  loader:      { svg: loaderSvg,      source: 'lucide/loader',      tags: ['loading','spinner','pending','progress'] } as IconEntry,
  play:        { svg: playSvg,        source: 'lucide/play',        tags: ['play','start','media','video','resume'] } as IconEntry,
  pause:       { svg: pauseSvg,       source: 'lucide/pause',       tags: ['pause','hold','media'] } as IconEntry,
  plus:        { svg: plusSvg,        source: 'lucide/plus',        tags: ['add','plus','new','create'] } as IconEntry,
  minus:       { svg: minusSvg,       source: 'lucide/minus',       tags: ['minus','subtract','decrease','remove'] } as IconEntry,
  check:       { svg: checkSvg,       source: 'lucide/check',       tags: ['check','confirm','selected','done','tick'] } as IconEntry,
  info:        { svg: infoSvg,        source: 'lucide/info',        tags: ['info','information','hint','help'] } as IconEntry,
  alertCircle: { svg: alertCircleSvg, source: 'lucide/alert-circle', tags: ['alert','error','warning','exclamation','circle'] } as IconEntry,
  moon:        { svg: moonSvg,        source: 'lucide/moon',        tags: ['moon','dark','night','theme-dark'] } as IconEntry,
  sun:         { svg: sunSvg,         source: 'lucide/sun',         tags: ['sun','light','day','theme-light'] } as IconEntry,
  power:       { svg: powerSvg,       source: 'lucide/power',       tags: ['power','on','off','toggle','enable','disable'] } as IconEntry,
  trash:       { svg: trashSvg,       source: 'lucide/trash',       tags: ['trash','delete','remove','bin'] } as IconEntry,
  copy:        { svg: copySvg,        source: 'lucide/copy',        tags: ['copy','clipboard','duplicate'] } as IconEntry,
  clock:       { svg: clockSvg,       source: 'lucide/clock',       tags: ['clock','time','duration','queued','timer'] } as IconEntry,
  menu:        { svg: menuSvg,        source: 'lucide/menu',        tags: ['menu','hamburger','sidebar','toggle'] } as IconEntry,
  ellipsisVertical: { svg: ellipsisVerticalSvg, source: 'lucide/ellipsis-vertical', tags: ['ellipsis','vertical','kebab','more','dots','three-dots','menu'] } as IconEntry,
  video:       { svg: videoSvg,       source: 'lucide/video',       tags: ['video','media','player','film'] } as IconEntry,
  flag:        { svg: flagSvg,        source: 'lucide/flag',        tags: ['flag','subtitle','caption','mark'] } as IconEntry,
  rotateCcw:   { svg: rotateCcwSvg,   source: 'lucide/rotate-ccw',  tags: ['rotate','retry','reset','undo','refresh'] } as IconEntry,
  panelRight:  { svg: panelRightSvg,  source: 'lucide/panel-right', tags: ['panel','side','sidebar','toggle'] } as IconEntry,
  chevronLeft: { svg: chevronLeftSvg, source: 'lucide/chevron-left', tags: ['chevron','left','back','arrow-left','prev'] } as IconEntry,
  chevronRight:{ svg: chevronRightSvg, source: 'lucide/chevron-right', tags: ['chevron','right','forward','arrow-right','next'] } as IconEntry,
  repeat:      { svg: repeatSvg,      source: 'lucide/repeat',      tags: ['repeat','loop','cycle'] } as IconEntry,

  // === Status / toast ===
  triangleAlert: { svg: triangleAlertSvg, source: 'lucide/triangle-alert', tags: ['warning','alert','triangle','caution'] } as IconEntry,
  circleCheck:   { svg: circleCheckSvg,   source: 'lucide/circle-check',   tags: ['success','check','circle','done','ok'] } as IconEntry,
  circleX:       { svg: circleXSvg,       source: 'lucide/circle-x',       tags: ['error','fail','circle','x','close'] } as IconEntry,
  circleInfo:    { svg: circleInfoSvg,    source: 'lucide/circle-info',    tags: ['info','toast','circle','i'] } as IconEntry,
  messageSquare: { svg: messageSquareSvg, source: 'lucide/message-square', tags: ['message','sentence','text','speech','bubble','chat','audio-sentence'] } as IconEntry,
  bookOpen:    { svg: bookOpenSvg,    source: 'lucide/book-open',    tags: ['dictionary','book','lexicon'] } as IconEntry,

  // === Nav cluster ===
  navPrev:         { svg: navPrevSvg,         source: 'svgrepo/round-alt-arrow-left',  tags: ['nav','prev','previous','back','sentence','chevron-left','circle'] } as IconEntry,
  navNext:         { svg: navNextSvg,         source: 'svgrepo/round-alt-arrow-right', tags: ['nav','next','forward','sentence','chevron-right','circle'] } as IconEntry,
  navRepeat:       { svg: navRepeatSvg,       source: 'svgrepo/restart',               tags: ['nav','repeat','loop','cycle','restart','circular-arrow'] } as IconEntry,
  navRepeatA:      { svg: navRepeatASvg,      source: 'custom/nav-cluster',            tags: ['nav','repeat','loop','start','a','loop-start'] } as IconEntry,
  navRepeatB:      { svg: navRepeatBSvg,      source: 'custom/nav-cluster',            tags: ['nav','repeat','loop','end','b','loop-end'] } as IconEntry,
  navRepeatCancel: { svg: navRepeatCancelSvg, source: 'custom/nav-cluster',            tags: ['nav','repeat','cancel','stop','loop-stop','x'] } as IconEntry,
  navRewind:       { svg: navRewindSvg,       source: 'svgrepo/rewind-5-seconds-back', tags: ['nav','rewind','back','5','seconds','seek'] } as IconEntry,
  navForward:      { svg: navForwardSvg,      source: 'svgrepo/rewind-10-seconds-forward', tags: ['nav','forward','skip','10','seconds','seek'] } as IconEntry,
  navPlay:         { svg: navPlaySvg,         source: 'custom/nav-cluster (Bootstrap play-circle)', tags: ['nav','play','start','media','video','resume','circle'] } as IconEntry,
  navPause:        { svg: navPauseSvg,        source: 'custom/nav-cluster (Bootstrap pause-circle)', tags: ['nav','pause','hold','media','video','circle'] } as IconEntry,

  // === Subtitle overlay ===
  generateNative:  { svg: generateNativeSvg,  source: 'custom/subtitle-block',      tags: ['generate','native','translate','exchange','bidirectional','arrows'] } as IconEntry,
  sidePanel:       { svg: sidePanelSvg,       source: 'custom/subtitle-panel',      tags: ['side','panel','toggle','split','rect'] } as IconEntry,
  subtitleManager: { svg: subtitleManagerSvg, source: 'custom/subtitle-manager',    tags: ['subtitle','manager','list','panel','lines'] } as IconEntry,
  resetOffset:     { svg: resetOffsetSvg,     source: 'custom/subtitle-offset',     tags: ['reset','offset','circular-arrow','hook','undo'] } as IconEntry,
  slidersHorizontal: { svg: slidersHorizontalSvg, source: 'lucide/sliders-horizontal', tags: ['sliders','customize','appearance','settings','adjust','tune','levels'] } as IconEntry,

  // === Media / window control ===
  externalLink: { svg: externalLinkSvg, source: 'lucide/external-link', tags: ['external','link','open','new-tab','outbound'] } as IconEntry,
  checkDouble:  { svg: checkDoubleSvg,  source: 'lucide/check-check',   tags: ['check','double','done','confirm','verified','all'] } as IconEntry,
  wrench:       { svg: wrenchSvg,       source: 'lucide/wrench',        tags: ['wrench','settings','config','tool','fix','repair'] } as IconEntry,
  microphone:   { svg: microphoneSvg,   source: 'lucide/microphone',    tags: ['microphone','voice','audio','record','speak','mic'] } as IconEntry,
  volumeHigh:   { svg: volumeHighSvg,   source: 'lucide/volume-2',      tags: ['volume','high','loud','sound','audio','speaker'] } as IconEntry,
  volumeLow:    { svg: volumeLowSvg,    source: 'lucide/volume-1',      tags: ['volume','low','quiet','sound','audio','speaker'] } as IconEntry,
  volumeMute:   { svg: volumeMuteSvg,   source: 'lucide/volume-x',      tags: ['volume','mute','silent','off','sound','audio','speaker'] } as IconEntry,
  captions:     { svg: captionsSvg,     source: 'lucide/captions',      tags: ['captions','subtitle','cc','closed-caption','text','accessibility'] } as IconEntry,
  maximize:     { svg: maximizeSvg,     source: 'lucide/maximize',      tags: ['maximize','expand','fullscreen','enlarge','scale-up'] } as IconEntry,
  minimize:     { svg: minimizeSvg,     source: 'lucide/minimize',      tags: ['minimize','collapse','shrink','scale-down','reduce'] } as IconEntry,
  pip:          { svg: pipSvg,          source: 'lucide/pip',           tags: ['pip','picture-in-picture','overlay','mini-player','video'] } as IconEntry,
  pin:          { svg: pinSvg,          source: 'lucide/pin',           tags: ['pin','attach','anchor','fixed','lock-position'] } as IconEntry,
  pinOff:       { svg: pinOffSvg,       source: 'lucide/pin-off',       tags: ['pin','off','unpin','detach','release','unlock-position'] } as IconEntry,

  // === Design system showcase — atomic design level icons ===
  layers:       { svg: layersSvg,       source: 'custom/design-system', tags: ['layers','stack','foundation','design-tokens','base','tier'] } as IconEntry,
  atom:         { svg: atomSvg,         source: 'lucide/atom',           tags: ['atom','orbital','electron','nucleus','particle','smallest-unit'] } as IconEntry,
  molecule:     { svg: moleculeSvg,     source: 'custom/design-system',  tags: ['molecule','bond','triangle','atoms-combined','compound'] } as IconEntry,
  organism:     { svg: organismSvg,     source: 'custom/design-system',  tags: ['organism','cell','organelles','complex-unit','biological'] } as IconEntry,
  wireframe:    { svg: wireframeSvg,    source: 'custom/design-system',  tags: ['wireframe','template','layout','scaffold','blueprint','sections'] } as IconEntry,
  windowPage:   { svg: windowPageSvg,   source: 'custom/design-system',  tags: ['page','window','browser','document','final','complete'] } as IconEntry,
} as const;

/** Find icon entries by tag (fuzzy semantic search). */
export function findIconsByTag(tag: string): readonly IconEntry[] {
  const lower = tag.toLowerCase();
  return Object.values(ICON_CATALOG).filter(e => e.tags.includes(lower));
}
