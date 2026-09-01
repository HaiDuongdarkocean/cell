import { useState, useRef, useEffect, useCallback, useMemo, type ReactElement } from 'react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Toggle } from '@/shared/ui/Toggle';
import { SliderRow } from '@/shared/ui/SliderRow';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { CopyButton } from '@/shared/ui/CopyButton';
import { IconButton } from '@/shared/ui/IconButton';
import { Input } from '@/shared/ui/Input';
import { SearchField } from '@/shared/ui/SearchField';
import { Pagination } from '@/shared/ui/Pagination';
import { Icon } from '@/shared/icons/Icon';
import styles from './ClipboardPage.module.css';


interface ClipboardItem {
  readonly id: number;
  readonly name: string;
  readonly text: string;
  readonly updatedAt: string;
  readonly pinned: boolean;
}

const INITIAL_ITEMS: ClipboardItem[] = [
  {
    id: 1,
    name: 'Game dialog — quest text',
    text: 'The quick brown fox jumps over the lazy dog. This is a sample text copied from a native game dialog to test the clipboard bridge feature. The hero approaches the ancient altar, its surface etched with runes that glow faintly in the moonlight. A voice echoes from within: "Speak the word of power, and the gate shall open." The player must choose between three options, each leading to a different branch of the storyline. The first option requires wisdom, the second courage, and the third a sacrifice of something precious. Whatever the choice, the consequences ripple through the remaining chapters of the game.',
    updatedAt: '14:32',
    pinned: true,
  },
  {
    id: 2,
    name: 'serendipity',
    text: 'serendipity',
    updatedAt: '14:28',
    pinned: false,
  },
  {
    id: 3,
    name: 'Notes — language learning',
    text: 'Hello world. This is another clipboard entry with multiple sentences. The tách đoạn toggle will break long text into readable cue sentences. Each cue has its own copy button. Language learning is a lifelong journey. Consistency matters more than intensity. Review spaced repetition daily. Immerse in native content whenever possible. Don\'t be afraid to make mistakes — they are the fastest path to fluency. Track progress in a journal. Celebrate small wins. Every word learned is a step forward.',
    updatedAt: '14:15',
    pinned: true,
  },
  {
    id: 4,
    name: 'Article excerpt — ML basics',
    text: 'Machine learning is a subset of artificial intelligence. It focuses on algorithms that learn from data. Deep learning uses neural networks with many layers. Supervised learning requires labeled data. Unsupervised learning finds patterns in unlabeled data. Reinforcement learning trains agents through rewards. The choice of algorithm depends on the problem type, data size, and computational resources. Overfitting occurs when a model memorizes training data but fails to generalize. Cross-validation helps detect overfitting. Regularization techniques like dropout and L2 penalty reduce it.',
    updatedAt: '13:50',
    pinned: false,
  },
  {
    id: 5,
    name: 'Chat message',
    text: 'Hey, can you check this word for me?',
    updatedAt: '13:42',
    pinned: false,
  },
  {
    id: 6,
    name: 'Novel chapter — The Last Lighthouse',
    text: 'The lighthouse stood at the edge of the cliff, its beam cutting through the fog like a sword through silk. Mara had lived there for thirty years, ever since her father disappeared on a night much like this one. The villagers said he was taken by the sea. Mara believed otherwise. She had seen the lights that night — not the lighthouse beam, but something else, something that pulsed in colors no human eye should recognize. Every evening she climbed the spiral staircase, 112 steps, each one worn smooth by generations of keepers. At the top she would light the great lamp, adjust the lens, and watch the horizon. Tonight was different. Tonight the fog was thicker than she had ever seen, and the lights had returned. They danced just above the water, three of them, moving in patterns that seemed almost like language. Mara grabbed her father\'s old journal from the drawer beneath the radio. The pages were yellowed, the ink faded, but the drawings were clear — three circles, pulsing, connected by lines. She had dismissed them as a child\'s fancy. Now she was not so sure. She reached for the radio, but it was dead, as it had been for years. The phone line was silent too. She was alone with the lights. The beam of the lighthouse swept across the water, and for a moment it illuminated something — a shape, dark and vast, just beneath the surface. Mara\'s hands trembled. She had never been afraid of the sea. She had been born on it, her mother used to say, born in a storm that nearly took them both. But this was something else. The lights moved closer. The shape rose. And then, from the fog, a voice — not from the radio, not from anywhere she could point to — spoke her name. "Mara." It was her father\'s voice. She dropped the journal. The pages scattered across the floor, drawings spinning in the draft from the broken window. "Mara," the voice said again, softer now, almost gentle. "It is time to come home." The lighthouse beam flickered. The lights below pulsed in unison. And Mara, for the first time in thirty years, began to descend the staircase.',
    updatedAt: '13:20',
    pinned: false,
  },
  {
    id: 7,
    name: 'Research paper abstract — Coral bleaching',
    text: 'Coral bleaching is a phenomenon that occurs when corals lose their symbiotic algae, known as zooxanthellae, due to stress factors such as increased sea temperatures. This process results in the corals turning white, as the algae are responsible for their characteristic colors. Without the algae, corals are deprived of their primary food source and become more susceptible to disease. The frequency and severity of bleaching events have increased dramatically over the past three decades, largely attributed to climate change. The Great Barrier Reef, the world\'s largest coral reef system, has experienced five mass bleaching events since 1998. Recovery from bleaching is possible if stress conditions are alleviated, but repeated events leave reefs increasingly vulnerable. Scientists are exploring various interventions, including coral transplantation, selective breeding for heat tolerance, and the development of synthetic algae. However, the most effective solution remains the reduction of global greenhouse gas emissions. Local conservation efforts, such as reducing agricultural runoff and establishing marine protected areas, can also improve reef resilience. The economic impact of coral reef degradation is significant, affecting fisheries, tourism, and coastal protection. An estimated 500 million people depend on coral reefs for their livelihood. The loss of these ecosystems would represent not only an ecological tragedy but a humanitarian crisis.',
    updatedAt: '12:55',
    pinned: false,
  },
];

const FONT_FAMILIES: SelectOption[] = [
  { value: 'system', label: 'System' },
  { value: 'serif', label: 'Serif' },
  { value: 'sans', label: 'Sans-serif' },
  { value: 'mono', label: 'Monospace' },
];

export function Showcase(): ReactElement {
  const [items, setItems] = useState<ClipboardItem[]>(INITIAL_ITEMS);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [splitSentences, setSplitSentences] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('system');
  const [sidebarVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number>(1);
  const [contentPage, setContentPage] = useState(0);
  const [editedText, setEditedText] = useState<string>('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const nextIdRef = useRef(100);
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [pageBreaks, setPageBreaks] = useState<number[]>([0]);

  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;
  const currentText = editedText || selectedItem?.text || '';
  const sentences = useMemo(
    () => (currentText ? currentText.split(/(?<=\. )/).filter((s) => s.trim().length > 0) : []),
    [currentText],
  );

  // Height-based pagination: measure each unit, group into pages that fit container
  // Split ON: paginate sentences. Split OFF: paginate by word chunks (text has no newlines)
  const computePageBreaks = useCallback(() => {
    if (!contentRef.current || !measureRef.current || !currentText) {
      setPageBreaks([0]);
      return;
    }
    const containerHeight = contentRef.current.clientHeight;
    const measureEl = measureRef.current;
    const fontStack = fontFamily === 'system' ? 'system-ui' : fontFamily === 'serif' ? 'Georgia, serif' : fontFamily === 'mono' ? 'monospace' : 'sans-serif';
    measureEl.style.fontSize = `${fontSize}px`;
    measureEl.style.fontFamily = fontStack;
    measureEl.style.width = `${contentRef.current.clientWidth}px`;

    // Split ON: sentences. Split OFF: words (group into pages by height)
    const units = splitSentences ? sentences : currentText.split(/\s+/).filter(Boolean);
    if (units.length === 0) { setPageBreaks([0]); return; }

    const breaks: number[] = [0];
    let currentHeight = 0;
    let currentLine = '';

    if (splitSentences) {
      // Sentence mode: each sentence is a unit
      for (let i = 0; i < units.length; i++) {
        measureEl.textContent = units[i];
        const unitHeight = measureEl.offsetHeight;
        if (currentHeight + unitHeight > containerHeight && i > 0) {
          breaks.push(i);
          currentHeight = unitHeight;
        } else {
          currentHeight += unitHeight;
        }
      }
    } else {
      // Word mode: accumulate words until height overflows, then break
      for (let i = 0; i < units.length; i++) {
        const testLine = currentLine ? `${currentLine} ${units[i]}` : units[i];
        measureEl.textContent = testLine;
        const testHeight = measureEl.offsetHeight;
        if (testHeight > containerHeight && i > 0) {
          breaks.push(i);
          currentHeight = 0;
          currentLine = units[i];
        } else {
          currentHeight = testHeight;
          currentLine = testLine;
        }
      }
    }
    setPageBreaks(breaks);
  }, [currentText, splitSentences, sentences, fontSize, fontFamily]);

  useEffect(() => {
    computePageBreaks();
  }, [computePageBreaks, currentText, sidebarVisible]);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(() => computePageBreaks());
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [computePageBreaks]);

  const totalPages = pageBreaks.length;
  const safePage = Math.min(contentPage, totalPages - 1);
  const pageStart = pageBreaks[safePage] ?? 0;
  const pageEnd = pageBreaks[safePage + 1] ?? (splitSentences ? sentences.length : currentText.split(/\s+/).filter(Boolean).length);
  const displayUnits = splitSentences
    ? sentences.slice(pageStart, pageEnd)
    : [currentText.split(/\s+/).filter(Boolean).slice(pageStart, pageEnd).join(' ')];

  const handleAdd = (): void => {
    const id = nextIdRef.current++;
    const newItem: ClipboardItem = { id, name: 'Untitled', text: '', updatedAt: 'now', pinned: false };
    setItems((prev) => [newItem, ...prev]);
    setSelectedItemId(id);
    setContentPage(0);
    setEditedText('');
  };

  const handleRenameStart = (item: ClipboardItem): void => {
    setRenamingId(item.id);
    setRenameValue(item.name);
  };

  const handleRenameConfirm = (): void => {
    if (renamingId === null) return;
    setItems((prev) => prev.map((i) => i.id === renamingId ? { ...i, name: renameValue || 'Untitled', updatedAt: 'now' } : i));
    setRenamingId(null);
  };

  const handleDelete = (id: number): void => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedItemId === id) {
      const remaining = items.filter((i) => i.id !== id);
      setSelectedItemId(remaining[0]?.id ?? 0);
      setEditedText('');
    }
  };

  const handleTogglePin = (id: number): void => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, pinned: !i.pinned } : i));
    setMenuOpenId(null);
  };

  const filteredItems = searchQuery
    ? items.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;
  const pinnedItems = filteredItems.filter((i) => i.pinned);
  const recentItems = filteredItems.filter((i) => !i.pinned);

  const fontStack = fontFamily === 'system' ? 'system-ui' : fontFamily === 'serif' ? 'Georgia, serif' : fontFamily === 'mono' ? 'monospace' : 'sans-serif';

  const renderItemCard = (item: ClipboardItem): ReactElement => (
    <Card
      key={item.id}
      variant={item.id === selectedItemId ? 'selected' : 'interactive'}
      className={styles.historyCard}
      onClick={() => { setSelectedItemId(item.id); setContentPage(0); setEditedText(''); setMenuOpenId(null); setMobileSidebarOpen(false); }}
    >
      {renamingId === item.id ? (
        <Input
          className={styles.renameInput}
          value={renameValue}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameConfirm}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenamingId(null); }}
        />
      ) : (
        <>
          <div className={styles.historyRow}>
            {item.pinned && <Icon name="pin" className={styles.pinIcon} />}
            <span className={styles.historyNameText}>{item.name}</span>
            <span className={styles.historyTime}>{item.updatedAt}</span>
            <IconButton
              aria-label="More actions"
              size="xs"
              className={styles.kebabBtn}
              onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === item.id ? null : item.id); }}
            >
              <Icon name="ellipsisVertical" />
            </IconButton>
          </div>
          {menuOpenId === item.id && (
            <div className={styles.kebabMenu} onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" className={styles.menuItem} onClick={() => { handleRenameStart(item); setMenuOpenId(null); }}>
                <Icon name="pencil" /><span>Rename</span>
              </Button>
              <Button size="sm" variant="ghost" className={styles.menuItem} onClick={() => handleTogglePin(item.id)}>
                <Icon name={item.pinned ? 'pinOff' : 'pin'} /><span>{item.pinned ? 'Unpin' : 'Pin'}</span>
              </Button>
              <Button size="sm" variant="destructive" className={styles.menuItem} onClick={() => { handleDelete(item.id); setMenuOpenId(null); }}>
                <Icon name="trash" /><span>Delete</span>
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.body}>
        <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''} ${mobileSidebarOpen ? styles.sidebarMobileOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            {!sidebarCollapsed && <h1 className={styles.title}>Clipboard</h1>}
            <div className={styles.sidebarHeaderActions}>
              {!sidebarCollapsed && (
                <IconButton aria-label="Search" size="sm" onClick={() => setSearchOpen((v) => !v)}>
                  <Icon name="search" />
                </IconButton>
              )}
              <IconButton aria-label="Toggle sidebar" size="sm" onClick={() => setSidebarCollapsed((v) => !v)}>
                <Icon name={sidebarCollapsed ? 'chevronRight' : 'chevronLeft'} />
              </IconButton>
            </div>
          </div>

          {searchOpen && !sidebarCollapsed && (
            <div className={styles.searchBar}>
              <SearchField
                className={styles.searchInput}
                placeholder="Search clipboard..."
                value={searchQuery}
                onChange={setSearchQuery}
                autoFocus
              />
            </div>
          )}

          {!sidebarCollapsed && (
            <div className={styles.sidebarBody}>
              <Button size="sm" variant="outline" className={styles.newClipboardBtn} onClick={handleAdd}>
                <Icon name="plus" /><span>New clipboard</span>
              </Button>

              {pinnedItems.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Pinned</div>
                  {pinnedItems.map(renderItemCard)}
                </div>
              )}

              {recentItems.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Recents</div>
                  {recentItems.map(renderItemCard)}
                </div>
              )}

              {filteredItems.length === 0 && (
                <div className={styles.emptySearch}>No results</div>
              )}
            </div>
          )}
        </aside>

        <main className={styles.detailPanel}>
          {settingsOpen && (
            <div className={styles.settingsPanel}>
              <div className={styles.settingRow}>
                <span className={styles.settingLabel}>Auto-update</span>
                <Toggle checked={autoUpdate} onChange={setAutoUpdate} ariaLabel="Auto-update clipboard" size="sm" />
              </div>
              <div className={styles.settingRow}>
                <span className={styles.settingLabel}>Tách câu</span>
                <Toggle checked={splitSentences} onChange={setSplitSentences} ariaLabel="Split sentences" size="sm" />
              </div>
              <div className={styles.settingSliderRow}>
                <SliderRow
                  label="Font size"
                  value={fontSize}
                  min={12}
                  max={28}
                  step={1}
                  onChange={setFontSize}
                  aria-label="Font size"
                  variant="end"
                  formatValue={(v) => `${v}px`}
                />
              </div>
              <div className={styles.settingRow}>
                <span className={styles.settingLabel}>Font</span>
                <Select value={fontFamily} onChange={setFontFamily} options={FONT_FAMILIES} aria-label="Font family" menuAlign="right" />
              </div>
            </div>
          )}

          {selectedItem ? (
            <>
              <div className={styles.detailHeader}>
                <div className={styles.detailNameGroup}>
                  <IconButton aria-label="Toggle sidebar" size="sm" className={styles.mobileSidebarToggle} onClick={() => setMobileSidebarOpen((v) => !v)}>
                    <Icon name="menu" />
                  </IconButton>
                  <h2 className={styles.detailName}>{selectedItem.name}</h2>
                </div>
                <div className={styles.detailActions}>
                  {!splitSentences && <CopyButton value={currentText} label="Copy all" className={styles.detailActionBtn} />}
                  <IconButton aria-label={isEditing ? 'Save edit' : 'Edit text'} size="sm" variant={isEditing ? 'solid' : 'ghost'} active={isEditing} className={styles.detailActionBtn} onClick={() => {
                    if (isEditing) {
                      const text = contentRef.current?.textContent ?? '';
                      setEditedText(text);
                    }
                    setIsEditing((v) => !v);
                  }}>
                    <Icon name={isEditing ? 'check' : 'pencil'} />
                  </IconButton>
                  <IconButton aria-label="Settings" size="sm" className={styles.detailActionBtn} onClick={() => setSettingsOpen((v) => !v)}>
                    <Icon name="settings" />
                  </IconButton>
                  {/* Mobile kebab — collapses all actions into 3-dot menu */}
                  <div className={styles.mobileActions}>
                    <IconButton aria-label="More actions" size="sm" onClick={() => setMenuOpenId(menuOpenId === -1 ? null : -1)}>
                      <Icon name="ellipsisVertical" />
                    </IconButton>
                    {menuOpenId === -1 && (
                      <div className={styles.kebabMenu} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.menuItem} onClick={() => { setSettingsOpen((v) => !v); setMenuOpenId(null); }}>
                          <Icon name="settings" /><span>Settings</span>
                        </button>
                        <button className={styles.menuItem} onClick={() => {
                          if (isEditing) { setEditedText(contentRef.current?.textContent ?? ''); }
                          setIsEditing((v) => !v); setMenuOpenId(null);
                        }}>
                          <Icon name={isEditing ? 'check' : 'pencil'} /><span>{isEditing ? 'Save edit' : 'Edit'}</span>
                        </button>
                        {!splitSentences && (
                          <button className={styles.menuItem} onClick={() => { navigator.clipboard?.writeText(currentText); setMenuOpenId(null); }}>
                            <Icon name="copy" /><span>Copy all</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div
                ref={contentRef}
                className={styles.detailContent}
                style={{ fontSize: `${fontSize}px`, fontFamily: fontStack }}
                contentEditable={isEditing}
                suppressContentEditableWarning
                onBlur={(e) => { if (isEditing) setEditedText(e.currentTarget.textContent ?? ''); }}
              >
                {displayUnits.map((unit, i) => (
                  <div key={i} className={styles.cueRow}>
                    <p className={styles.cueText}>{unit}</p>
                    {splitSentences && <CopyButton value={unit} />}
                  </div>
                ))}
              </div>
              {/* Hidden measure element for height-based pagination */}
              <div ref={measureRef} className={styles.measureEl} aria-hidden="true" />
              {totalPages > 1 && (
                <Pagination current={safePage} total={totalPages} onChange={setContentPage} />
              )}
            </>
          ) : (
            <div className={styles.emptyState}><p>Select an item</p></div>
          )}
        </main>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Clipboard Page',
  description: 'Clipboard bridge tab for universal panel: sidebar history (name + updated time, pagination, toggle show/hide), settings popover (auto-update, tách câu, font size/family), cue sentence copy buttons when split on. Mobile-first responsive 320→desktop. Reuses Card, Toggle, SliderRow, CopyButton, Select, IconButton.',
  level: 'pages' as const,
  category: 'Feature',
  order: 20,
};
