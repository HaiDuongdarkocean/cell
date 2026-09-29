import { buildTokenSpanCss } from '@/features/tokenize/ui/tokenSpanCss';
import '@/shared/styles/document.css';

const style = document.createElement('style');
style.textContent = buildTokenSpanCss();
document.head.appendChild(style);

type Status = 'unknown' | 'tracking' | 'known' | 'ignore';
type Word = [text: string, status: Status | null];

const SENTENCE: Word[] = [
  ['The', null],
  ['quick', 'unknown'],
  ['brown', null],
  ['fox', 'tracking'],
  ['jumps', 'known'],
  ['over', null],
  ['the', null],
  ['lazy', 'unknown'],
  ['dog', 'ignore'],
  ['near', null],
  ['the', null],
  ['river', 'tracking'],
  ['bank', null],
  ['today', 'unknown'],
];

const STATUSES: Status[] = ['unknown', 'tracking', 'known', 'ignore'];

interface Palette {
  id: string;
  title: string;
  bar: Record<Status, string>;
}

const PALETTES: Palette[] = [
  {
    id: 'live',
    title: 'Live — production tokens (synced: bar + chip derive from one base hue)',
    bar: { unknown: '#FF0033', tracking: '#FF9500', known: '#00C853', ignore: '#8E8E93' },
  },
];

function tokenEl(word: Word): HTMLSpanElement {
  const [text, status] = word;
  const span = document.createElement('span');
  span.className = 'js-cell-token';
  if (status) {
    span.classList.add(`js-cell-token--status-${status}`);
    if (status === 'known' || status === 'ignore') {
      span.classList.add('js-cell-token--popup-open');
    }
  }
  span.textContent = text;
  return span;
}

function buildCard(palette: Palette, theme: 'light' | 'dark'): HTMLElement {
  const card = document.createElement('div');
  card.className = `card card--${theme}`;
  card.setAttribute('data-theme', theme);

  const label = document.createElement('div');
  label.className = 'card-label';
  label.textContent = theme === 'light' ? 'Light surface' : 'Dark / video surface';
  card.appendChild(label);

  const sentence = document.createElement('p');
  sentence.className = 'sentence';
  SENTENCE.forEach((word, i) => {
    if (i > 0) sentence.appendChild(document.createTextNode(' '));
    sentence.appendChild(tokenEl(word));
  });
  card.appendChild(sentence);

  const legend = document.createElement('div');
  legend.className = 'legend';
  for (const status of STATUSES) {
    const sw = document.createElement('span');
    sw.className = 'swatch';
    const bar = document.createElement('i');
    bar.style.background = palette.bar[status];
    const txt = document.createElement('span');
    txt.innerHTML = `<b>${status}</b> ${palette.bar[status]}`;
    sw.append(bar, txt);
    legend.appendChild(sw);
  }
  card.appendChild(legend);

  const divider = document.createElement('div');
  divider.className = 'divider';
  card.appendChild(divider);

  const chips = document.createElement('div');
  chips.className = 'chips';
  for (const status of STATUSES) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = `var(--chip-status-${status}-bg)`;
    chip.style.color = `var(--chip-status-${status}-fg)`;
    chip.textContent = status;
    chips.appendChild(chip);
  }
  card.appendChild(chips);

  return card;
}

function buildPaletteSection(palette: Palette): HTMLElement {
  const section = document.createElement('section');
  section.className = 'palette';
  section.dataset.palette = palette.id;

  const h2 = document.createElement('h2');
  h2.textContent = palette.title;
  section.appendChild(h2);

  section.appendChild(buildCard(palette, 'light'));
  section.appendChild(buildCard(palette, 'dark'));

  return section;
}

const host = document.getElementById('palettes');
if (host) {
  for (const palette of PALETTES) host.appendChild(buildPaletteSection(palette));
}
