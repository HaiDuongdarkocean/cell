// SVG icon registry — single source of truth for icons in the codebase.
//
// Most icons are sourced from lucide-react and vendored as raw SVGs under ./svg.
// Each catalog entry exposes a React component for JSX and a raw SVG string for non-React DOM.
//
// Convention: 24×24, stroke 2, currentColor, round caps, round joins.
//
// Nav cluster media controls use Phosphor `fill` weight components for visibility on
// translucent liquid-glass buttons, while their raw SVGs remain lucide for non-React DOM.

import type { ComponentType, CSSProperties } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  AppWindow,
  ArrowLeftRight,
  ArrowUpDown,
  Atom,
  AudioLines,
  BookOpen,
  Captions,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Component,
  Copy,
  Crop,
  Download,
  EllipsisVertical,
  ExternalLink,
  Eye,
  EyeOff,
  FileVideo,
  Flag,
  FolderOpen,
  Gauge,
  Image,
  Info,
  Languages,
  Layers,
  LayoutTemplate,
  Library,
  Link,
  Loader,
  Maximize,
  Maximize2,
  Menu,
  MessageSquare,
  Mic,
  Minimize,
  Minus,
  Moon,
  Move,
  PanelBottomClose,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  PanelRightOpen,
  Pause,
  Pencil,
  PictureInPicture,
  Pin,
  PinOff,
  Play,
  PlaySquare,
  Plus,
  Power,
  Repeat,
  RotateCcw,
  ScanText,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  Trash,
  Users,
  Video,
  Volume1,
  Volume2,
  VolumeX,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

import {
  NavForward,
  NavNext,
  NavPause,
  NavPlay,
  NavPrev,
  NavRepeat,
  NavRepeatA,
  NavRepeatB,
  NavRepeatCancel,
  NavRewind,
} from './phosphorNavIcons';

import settingsSvg from './svg/settings.svg?raw';
import pencilSvg from './svg/pencil.svg?raw';
import zapSvg from './svg/zap.svg?raw';
import resizeSvg from './svg/maximize-2.svg?raw';
import audioWaveSvg from './svg/audio-lines.svg?raw';
import imageSvg from './svg/image.svg?raw';
import languagesSvg from './svg/languages.svg?raw';
import linkSvg from './svg/link.svg?raw';
import eyeSvg from './svg/eye.svg?raw';
import eyeOffSvg from './svg/eye-off.svg?raw';
import chevronDownSvg from './svg/chevron-down.svg?raw';
import panelBottomCloseSvg from './svg/panel-bottom-close.svg?raw';
import panelLeftCollapseSvg from './svg/panel-left-close.svg?raw';
import panelLeftExpandSvg from './svg/panel-left-open.svg?raw';
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
import triangleAlertSvg from './svg/alert-triangle.svg?raw';
import circleCheckSvg from './svg/circle-check.svg?raw';
import circleXSvg from './svg/circle-x.svg?raw';
import circleInfoSvg from './svg/circle-alert.svg?raw';
import messageSquareSvg from './svg/message-square.svg?raw';
import bookOpenSvg from './svg/book-open.svg?raw';
import folderOpenSvg from './svg/folder-open.svg?raw';
import librarySvg from './svg/library.svg?raw';
import fileVideoSvg from './svg/file-video.svg?raw';
import playRoundedRectSvg from './svg/play-square.svg?raw';
import navPrevSvg from './svg/circle-chevron-left.svg?raw';
import navNextSvg from './svg/circle-chevron-right.svg?raw';
import navRepeatSvg from './svg/repeat.svg?raw';
import navRepeatASvg from './svg/repeat-1.svg?raw';
import navRepeatBSvg from './svg/repeat-2.svg?raw';
import navRepeatCancelSvg from './svg/repeat-off.svg?raw';
import navRewindSvg from './svg/rewind.svg?raw';
import navForwardSvg from './svg/fast-forward.svg?raw';
import navPlaySvg from './svg/circle-play.svg?raw';
import navPauseSvg from './svg/circle-pause.svg?raw';
import generateNativeSvg from './svg/languages.svg?raw';
import sidePanelSvg from './svg/panel-right-open.svg?raw';
import subtitleManagerSvg from './svg/library.svg?raw';
import resetOffsetSvg from './svg/rotate-ccw.svg?raw';
import slidersHorizontalSvg from './svg/sliders-horizontal.svg?raw';
import externalLinkSvg from './svg/external-link.svg?raw';
import checkDoubleSvg from './svg/check-check.svg?raw';
import wrenchSvg from './svg/wrench.svg?raw';
import microphoneSvg from './svg/mic.svg?raw';
import volumeHighSvg from './svg/volume-2.svg?raw';
import volumeLowSvg from './svg/volume-1.svg?raw';
import volumeMuteSvg from './svg/volume-x.svg?raw';
import captionsSvg from './svg/captions.svg?raw';
import maximizeSvg from './svg/maximize.svg?raw';
import cropSvg from './svg/crop.svg?raw';
import moveSvg from './svg/move.svg?raw';
import moveVerticalSvg from './svg/arrow-up-down.svg?raw';
import moveHorizontalSvg from './svg/arrow-left-right.svg?raw';
import scanTextSvg from './svg/scan-text.svg?raw';
import minimizeSvg from './svg/minimize.svg?raw';
import pipSvg from './svg/picture-in-picture.svg?raw';
import pinSvg from './svg/pin.svg?raw';
import pinOffSvg from './svg/pin-off.svg?raw';
import gaugeSvg from './svg/gauge.svg?raw';
import layersSvg from './svg/layers.svg?raw';
import atomSvg from './svg/atom.svg?raw';
import moleculeSvg from './svg/component.svg?raw';
import organismSvg from './svg/users.svg?raw';
import wireframeSvg from './svg/layout-template.svg?raw';
import windowPageSvg from './svg/app-window.svg?raw';

/** Semantic icon entry — query by tags to find reuse candidates. */
interface IconRenderProps {
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean;
}

export interface IconEntry {
  /** React icon component (lucide, phosphor, or custom). */
  readonly component: ComponentType<IconRenderProps>;
  /** Raw SVG markup string (inject via innerHTML). */
  readonly svg: string;
  /** Icon name or custom source label. */
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
 *   const icon = ICON_CATALOG.check;
 *   const svg = icon.svg;
 *   const Component = icon.component;
 */
export const ICON_CATALOG = {
  settings: { component: Settings, svg: settingsSvg, source: 'lucide/settings', tags: ['settings', 'gear', 'config', 'preferences'] } as IconEntry,
  pencil: { component: Pencil, svg: pencilSvg, source: 'lucide/pencil', tags: ['edit', 'write', 'pencil', 'modify'] } as IconEntry,
  zap: { component: Zap, svg: zapSvg, source: 'lucide/zap', tags: ['quick', 'fast', 'lightning', 'bolt', 'instant'] } as IconEntry,
  resize: { component: Maximize2, svg: resizeSvg, source: 'lucide/maximize-2', tags: ['resize', 'drag', 'handle', 'diagonal'] } as IconEntry,
  audioWave: { component: AudioLines, svg: audioWaveSvg, source: 'lucide/audio-lines', tags: ['audio', 'waveform', 'sound', 'voice', 'tts', 'play-audio'] } as IconEntry,
  image: { component: Image, svg: imageSvg, source: 'lucide/image', tags: ['image', 'picture', 'photo', 'gallery'] } as IconEntry,
  languages: { component: Languages, svg: languagesSvg, source: 'lucide/languages', tags: ['translate', 'languages', 'i18n', 'localize'] } as IconEntry,
  link: { component: Link, svg: linkSvg, source: 'lucide/link', tags: ['link', 'chain', 'url', 'external', 'hyperlink'] } as IconEntry,
  eye: { component: Eye, svg: eyeSvg, source: 'lucide/eye', tags: ['show', 'eye', 'visible', 'reveal', 'view'] } as IconEntry,
  eyeOff: { component: EyeOff, svg: eyeOffSvg, source: 'lucide/eye-off', tags: ['hide', 'eye-off', 'invisible', 'none', 'conceal'] } as IconEntry,
  chevronDown: { component: ChevronDown, svg: chevronDownSvg, source: 'lucide/chevron-down', tags: ['collapse', 'chevron', 'down', 'arrow-down', 'fold', 'dropdown', 'expand'] } as IconEntry,
  panelBottomClose: { component: PanelBottomClose, svg: panelBottomCloseSvg, source: 'lucide/panel-bottom-close', tags: ['panel', 'hide', 'close', 'bottom', 'collapse-panel'] } as IconEntry,
  panelLeftCollapse: { component: PanelLeftClose, svg: panelLeftCollapseSvg, source: 'lucide/panel-left-close', tags: ['panel', 'left', 'collapse', 'sidebar', 'hide'] } as IconEntry,
  panelLeftExpand: { component: PanelLeftOpen, svg: panelLeftExpandSvg, source: 'lucide/panel-left-open', tags: ['panel', 'left', 'expand', 'sidebar', 'show'] } as IconEntry,
  x: { component: X, svg: xSvg, source: 'lucide/x', tags: ['close', 'dismiss', 'cancel', 'x', 'clear'] } as IconEntry,
  download: { component: Download, svg: downloadSvg, source: 'lucide/download', tags: ['download', 'save', 'arrow-down-tray'] } as IconEntry,
  search: { component: Search, svg: searchSvg, source: 'lucide/search', tags: ['search', 'magnifier', 'find', 'lookup'] } as IconEntry,
  loader: { component: Loader, svg: loaderSvg, source: 'lucide/loader', tags: ['loading', 'spinner', 'pending', 'progress'] } as IconEntry,
  play: { component: Play, svg: playSvg, source: 'lucide/play', tags: ['play', 'start', 'media', 'video', 'resume'] } as IconEntry,
  pause: { component: Pause, svg: pauseSvg, source: 'lucide/pause', tags: ['pause', 'hold', 'media'] } as IconEntry,
  plus: { component: Plus, svg: plusSvg, source: 'lucide/plus', tags: ['add', 'plus', 'new', 'create'] } as IconEntry,
  minus: { component: Minus, svg: minusSvg, source: 'lucide/minus', tags: ['minus', 'subtract', 'decrease', 'remove'] } as IconEntry,
  check: { component: Check, svg: checkSvg, source: 'lucide/check', tags: ['check', 'confirm', 'selected', 'done', 'tick'] } as IconEntry,
  info: { component: Info, svg: infoSvg, source: 'lucide/info', tags: ['info', 'information', 'hint', 'help'] } as IconEntry,
  alertCircle: { component: AlertCircle, svg: alertCircleSvg, source: 'lucide/alert-circle', tags: ['alert', 'error', 'warning', 'exclamation', 'circle'] } as IconEntry,
  moon: { component: Moon, svg: moonSvg, source: 'lucide/moon', tags: ['moon', 'dark', 'night', 'theme-dark'] } as IconEntry,
  sun: { component: Sun, svg: sunSvg, source: 'lucide/sun', tags: ['sun', 'light', 'day', 'theme-light'] } as IconEntry,
  power: { component: Power, svg: powerSvg, source: 'lucide/power', tags: ['power', 'on', 'off', 'toggle', 'enable', 'disable'] } as IconEntry,
  trash: { component: Trash, svg: trashSvg, source: 'lucide/trash', tags: ['trash', 'delete', 'remove', 'bin'] } as IconEntry,
  copy: { component: Copy, svg: copySvg, source: 'lucide/copy', tags: ['copy', 'clipboard', 'duplicate'] } as IconEntry,
  clock: { component: Clock, svg: clockSvg, source: 'lucide/clock', tags: ['clock', 'time', 'duration', 'queued', 'timer'] } as IconEntry,
  menu: { component: Menu, svg: menuSvg, source: 'lucide/menu', tags: ['menu', 'hamburger', 'sidebar', 'toggle'] } as IconEntry,
  ellipsisVertical: { component: EllipsisVertical, svg: ellipsisVerticalSvg, source: 'lucide/ellipsis-vertical', tags: ['ellipsis', 'vertical', 'kebab', 'more', 'dots', 'three-dots', 'menu'] } as IconEntry,
  video: { component: Video, svg: videoSvg, source: 'lucide/video', tags: ['video', 'media', 'player', 'film'] } as IconEntry,
  flag: { component: Flag, svg: flagSvg, source: 'lucide/flag', tags: ['flag', 'subtitle', 'caption', 'mark'] } as IconEntry,
  rotateCcw: { component: RotateCcw, svg: rotateCcwSvg, source: 'lucide/rotate-ccw', tags: ['rotate', 'retry', 'reset', 'undo', 'refresh'] } as IconEntry,
  panelRight: { component: PanelRight, svg: panelRightSvg, source: 'lucide/panel-right', tags: ['panel', 'side', 'sidebar', 'toggle'] } as IconEntry,
  chevronLeft: { component: ChevronLeft, svg: chevronLeftSvg, source: 'lucide/chevron-left', tags: ['chevron', 'left', 'back', 'arrow-left', 'prev'] } as IconEntry,
  chevronRight: { component: ChevronRight, svg: chevronRightSvg, source: 'lucide/chevron-right', tags: ['chevron', 'right', 'forward', 'arrow-right', 'next'] } as IconEntry,
  repeat: { component: Repeat, svg: repeatSvg, source: 'lucide/repeat', tags: ['repeat', 'loop', 'cycle'] } as IconEntry,
  triangleAlert: { component: AlertTriangle, svg: triangleAlertSvg, source: 'lucide/alert-triangle', tags: ['warning', 'alert', 'triangle', 'caution'] } as IconEntry,
  circleCheck: { component: CircleCheck, svg: circleCheckSvg, source: 'lucide/circle-check', tags: ['success', 'check', 'circle', 'done', 'ok'] } as IconEntry,
  circleX: { component: CircleX, svg: circleXSvg, source: 'lucide/circle-x', tags: ['error', 'fail', 'circle', 'x', 'close'] } as IconEntry,
  circleInfo: { component: CircleAlert, svg: circleInfoSvg, source: 'lucide/circle-alert', tags: ['info', 'toast', 'circle', 'i'] } as IconEntry,
  messageSquare: { component: MessageSquare, svg: messageSquareSvg, source: 'lucide/message-square', tags: ['message', 'sentence', 'text', 'speech', 'bubble', 'chat', 'audio-sentence'] } as IconEntry,
  bookOpen: { component: BookOpen, svg: bookOpenSvg, source: 'lucide/book-open', tags: ['dictionary', 'book', 'lexicon'] } as IconEntry,
  folderOpen: { component: FolderOpen, svg: folderOpenSvg, source: 'lucide/folder-open', tags: ['folder', 'open', 'file', 'directory', 'browse'] } as IconEntry,
  library: { component: Library, svg: librarySvg, source: 'lucide/library', tags: ['library', 'collection', 'history', 'list', 'book-stack'] } as IconEntry,
  fileVideo: { component: FileVideo, svg: fileVideoSvg, source: 'lucide/file-video', tags: ['file', 'video', 'media', 'document', 'filename'] } as IconEntry,
  playRoundedRect: { component: PlaySquare, svg: playRoundedRectSvg, source: 'lucide/play-square', tags: ['play', 'video', 'media', 'player', 'local-player', 'rounded', 'rectangle'] } as IconEntry,
  navPrev: { component: NavPrev, svg: navPrevSvg, source: 'phosphor/arrow-circle-left', tags: ['nav', 'prev', 'previous', 'back', 'sentence', 'arrow-circle-left', 'circle'] } as IconEntry,
  navNext: { component: NavNext, svg: navNextSvg, source: 'phosphor/arrow-circle-right', tags: ['nav', 'next', 'forward', 'sentence', 'arrow-circle-right', 'circle'] } as IconEntry,
  navRepeat: { component: NavRepeat, svg: navRepeatSvg, source: 'phosphor/repeat', tags: ['nav', 'repeat', 'loop', 'cycle', 'restart', 'circular-arrow'] } as IconEntry,
  navRepeatA: { component: NavRepeatA, svg: navRepeatASvg, source: 'phosphor/repeat-once', tags: ['nav', 'repeat', 'loop', 'start', 'a', 'loop-start', 'once'] } as IconEntry,
  navRepeatB: { component: NavRepeatB, svg: navRepeatBSvg, source: 'phosphor/repeat', tags: ['nav', 'repeat', 'loop', 'end', 'b', 'loop-end'] } as IconEntry,
  navRepeatCancel: { component: NavRepeatCancel, svg: navRepeatCancelSvg, source: 'phosphor/prohibit', tags: ['nav', 'repeat', 'cancel', 'stop', 'loop-stop', 'prohibit'] } as IconEntry,
  navRewind: { component: NavRewind, svg: navRewindSvg, source: 'phosphor/arrow-counter-clockwise', tags: ['nav', 'rewind', 'back', '5', 'seconds', 'seek'] } as IconEntry,
  navForward: { component: NavForward, svg: navForwardSvg, source: 'phosphor/arrow-clockwise', tags: ['nav', 'forward', 'skip', '10', 'seconds', 'seek'] } as IconEntry,
  navPlay: { component: NavPlay, svg: navPlaySvg, source: 'phosphor/play-circle', tags: ['nav', 'play', 'start', 'media', 'video', 'resume', 'circle'] } as IconEntry,
  navPause: { component: NavPause, svg: navPauseSvg, source: 'phosphor/pause-circle', tags: ['nav', 'pause', 'hold', 'media', 'video', 'circle'] } as IconEntry,
  generateNative: { component: Languages, svg: generateNativeSvg, source: 'lucide/languages', tags: ['generate', 'native', 'translate', 'exchange', 'bidirectional', 'arrows'] } as IconEntry,
  sidePanel: { component: PanelRightOpen, svg: sidePanelSvg, source: 'lucide/panel-right-open', tags: ['side', 'panel', 'toggle', 'split', 'rect'] } as IconEntry,
  subtitleManager: { component: Library, svg: subtitleManagerSvg, source: 'lucide/library', tags: ['subtitle', 'manager', 'list', 'panel', 'lines'] } as IconEntry,
  resetOffset: { component: RotateCcw, svg: resetOffsetSvg, source: 'lucide/rotate-ccw', tags: ['reset', 'offset', 'circular-arrow', 'hook', 'undo'] } as IconEntry,
  slidersHorizontal: { component: SlidersHorizontal, svg: slidersHorizontalSvg, source: 'lucide/sliders-horizontal', tags: ['sliders', 'customize', 'appearance', 'settings', 'adjust', 'tune', 'levels'] } as IconEntry,
  externalLink: { component: ExternalLink, svg: externalLinkSvg, source: 'lucide/external-link', tags: ['external', 'link', 'open', 'new-tab', 'outbound'] } as IconEntry,
  checkDouble: { component: CheckCheck, svg: checkDoubleSvg, source: 'lucide/check-check', tags: ['check', 'double', 'done', 'confirm', 'verified', 'all'] } as IconEntry,
  wrench: { component: Wrench, svg: wrenchSvg, source: 'lucide/wrench', tags: ['wrench', 'settings', 'config', 'tool', 'fix', 'repair'] } as IconEntry,
  microphone: { component: Mic, svg: microphoneSvg, source: 'lucide/mic', tags: ['microphone', 'voice', 'audio', 'record', 'speak', 'mic'] } as IconEntry,
  volumeHigh: { component: Volume2, svg: volumeHighSvg, source: 'lucide/volume-2', tags: ['volume', 'high', 'loud', 'sound', 'audio', 'speaker'] } as IconEntry,
  volumeLow: { component: Volume1, svg: volumeLowSvg, source: 'lucide/volume-1', tags: ['volume', 'low', 'quiet', 'sound', 'audio', 'speaker'] } as IconEntry,
  volumeMute: { component: VolumeX, svg: volumeMuteSvg, source: 'lucide/volume-x', tags: ['volume', 'mute', 'silent', 'off', 'sound', 'audio', 'speaker'] } as IconEntry,
  captions: { component: Captions, svg: captionsSvg, source: 'lucide/captions', tags: ['captions', 'subtitle', 'cc', 'closed-caption', 'text', 'accessibility'] } as IconEntry,
  maximize: { component: Maximize, svg: maximizeSvg, source: 'lucide/maximize', tags: ['maximize', 'expand', 'fullscreen', 'enlarge', 'scale-up'] } as IconEntry,
  crop: { component: Crop, svg: cropSvg, source: 'lucide/crop', tags: ['crop', 'select-region', 'area', 'frame', 'capture', 'marquee'] } as IconEntry,
  move: { component: Move, svg: moveSvg, source: 'lucide/move', tags: ['move', 'drag', 'reposition', 'pan', 'all-directions'] } as IconEntry,
  moveVertical: { component: ArrowUpDown, svg: moveVerticalSvg, source: 'lucide/arrow-up-down', tags: ['move', 'vertical', 'height', 'resize-vertical', 'up-down'] } as IconEntry,
  moveHorizontal: { component: ArrowLeftRight, svg: moveHorizontalSvg, source: 'lucide/arrow-left-right', tags: ['move', 'horizontal', 'width', 'resize-horizontal', 'left-right'] } as IconEntry,
  scanText: { component: ScanText, svg: scanTextSvg, source: 'lucide/scan-text', tags: ['scan', 'text', 'ocr', 'detect-text', 'frame-text', 'recognize'] } as IconEntry,
  minimize: { component: Minimize, svg: minimizeSvg, source: 'lucide/minimize', tags: ['minimize', 'collapse', 'shrink', 'scale-down', 'reduce'] } as IconEntry,
  pip: { component: PictureInPicture, svg: pipSvg, source: 'lucide/picture-in-picture', tags: ['pip', 'picture-in-picture', 'overlay', 'mini-player', 'video'] } as IconEntry,
  pin: { component: Pin, svg: pinSvg, source: 'lucide/pin', tags: ['pin', 'attach', 'anchor', 'fixed', 'lock-position'] } as IconEntry,
  pinOff: { component: PinOff, svg: pinOffSvg, source: 'lucide/pin-off', tags: ['pin', 'off', 'unpin', 'detach', 'release', 'unlock-position'] } as IconEntry,
  gauge: { component: Gauge, svg: gaugeSvg, source: 'lucide/gauge', tags: ['gauge', 'speed', 'meter', 'playback-speed', 'rate', 'fast', 'slow'] } as IconEntry,
  layers: { component: Layers, svg: layersSvg, source: 'lucide/layers', tags: ['layers', 'stack', 'foundation', 'design-tokens', 'base', 'tier'] } as IconEntry,
  atom: { component: Atom, svg: atomSvg, source: 'lucide/atom', tags: ['atom', 'orbital', 'electron', 'nucleus', 'particle', 'smallest-unit'] } as IconEntry,
  molecule: { component: Component, svg: moleculeSvg, source: 'lucide/component', tags: ['molecule', 'bond', 'triangle', 'atoms-combined', 'compound'] } as IconEntry,
  organism: { component: Users, svg: organismSvg, source: 'lucide/users', tags: ['organism', 'cell', 'organelles', 'complex-unit', 'biological'] } as IconEntry,
  wireframe: { component: LayoutTemplate, svg: wireframeSvg, source: 'lucide/layout-template', tags: ['wireframe', 'template', 'layout', 'scaffold', 'blueprint', 'sections'] } as IconEntry,
  windowPage: { component: AppWindow, svg: windowPageSvg, source: 'lucide/app-window', tags: ['page', 'window', 'browser', 'document', 'final', 'complete'] } as IconEntry,
} as const;

/** Type-safe catalog key. */
export type IconCatalogKey = keyof typeof ICON_CATALOG;

/** Raw SVG strings for non-React DOM (e.g. OCR region selector toolbar). */
export {
  checkSvg as checkIcon,
  chevronLeftSvg as chevronLeftIcon,
  cropSvg as cropIcon,
  moveVerticalSvg as moveVerticalIcon,
  pencilSvg as pencilIcon,
  rotateCcwSvg as rotateCcwIcon,
  xSvg as xIcon,
};

/** Find an icon by a tag keyword. */
export function findIconByTag(tag: string): IconEntry | undefined {
  const lower = tag.toLowerCase();
  return Object.values(ICON_CATALOG).find(e => e.tags.includes(lower));
}
