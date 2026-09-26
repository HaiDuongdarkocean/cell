import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Button, Card, Checkbox, Icon, Toggle } from '@/shared/ui';
import { t, setUiLanguageOverride } from '@/shared/i18n';
import '@/shared/styles/document.css';
import './mockup.css';

document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'dark');
setUiLanguageOverride(new URLSearchParams(location.search).get('lang') ?? 'vi');

type Variant = 'current' | 'proposed';
type Theme = 'light' | 'dark';

interface MockResource {
  id: number;
  name: string;
  chips: string[];
  enabled: boolean;
}

const RESOURCES: MockResource[] = [
  { id: 1, name: 'LDOCE5pp', chips: ['định nghĩa', 'ví dụ', 'đồng/trái nghĩa', 'phiên âm', 'word forms', 'nguồn gốc', 'word family', 'liên quan', 'tần suất'], enabled: true },
  { id: 2, name: 'Collins-Cobuild-2024', chips: ['định nghĩa', 'ví dụ', 'đồng/trái nghĩa', 'phiên âm', 'liên quan'], enabled: true },
  { id: 3, name: 'OALD10', chips: ['định nghĩa', 'ví dụ', 'đồng/trái nghĩa', 'phiên âm', 'word forms', 'nguồn gốc', 'liên quan'], enabled: true },
  { id: 4, name: 'Macmillan-EnEn', chips: ['định nghĩa', 'ví dụ', 'đồng/trái nghĩa', 'word forms', 'liên quan'], enabled: true },
  { id: 5, name: 'Etymonline-2023', chips: ['định nghĩa', 'liên quan'], enabled: false },
];

function Section({ variant }: { variant: Variant }): React.ReactElement {
  const [selected, setSelected] = useState<Set<number>>(new Set([1, 3]));
  const count = selected.size;
  const all = count === RESOURCES.length;

  const toggle = (id: number): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onRowClick = (e: React.MouseEvent, id: number): void => {
    if (variant !== 'proposed') return;
    if ((e.target as HTMLElement).closest('button, input, a, [data-no-row-toggle]')) return;
    toggle(id);
  };

  return (
    <section className={`mrs-section mrs-${variant}`}>
      <div className="mrs-sectionHeader">
        <div>
          <h2 className="mrs-sectionTitle">Từ điển</h2>
          <p className="mrs-sectionSubtitle">Nghĩa, phiên âm, audio.</p>
        </div>
        <Button variant="ghost" size="sm" active aria-pressed="true" aria-label="Xong chỉnh sửa Từ điển" title="Xong">
          <Icon name="check" size="xs" />
        </Button>
      </div>

      <div className="mrs-editBar">
        <Checkbox
          checked={all}
          indeterminate={count > 0 && !all}
          onChange={all ? () => setSelected(new Set()) : () => setSelected(new Set(RESOURCES.map((r) => r.id)))}
          label={t('resources.edit.selectAll')}
          className="mrs-selectAll"
        />
        <span className="mrs-selectionCount">{t('resources.edit.selectedCount', [count, RESOURCES.length])}</span>
        <div className="mrs-editActions">
          <div className="mrs-actionGroup">
            <Button variant="link" size="sm" ripple={false} disabled={count === 0} className="mrs-action">
              {t('resources.edit.enable')}
            </Button>
            <Button variant="link" size="sm" ripple={false} disabled={count === 0} className="mrs-action">
              {t('resources.edit.disable')}
            </Button>
          </div>
          <Button variant="link" size="sm" ripple={false} className="mrs-action mrs-danger">
            {count > 0 ? t('resources.delete.selected', [count]) : t('resources.delete.all')}
          </Button>
        </div>
      </div>

      <div className="mrs-list">
        {RESOURCES.map((r) => (
          <Card
            key={r.id}
            variant={selected.has(r.id) ? 'selected' : 'default'}
            className={`mrs-card ${r.enabled ? '' : 'mrs-cardDisabled'}`}
            onClick={(e) => onRowClick(e, r.id)}
            role={variant === 'proposed' ? 'button' : undefined}
            aria-pressed={variant === 'proposed' ? selected.has(r.id) : undefined}
            tabIndex={variant === 'proposed' ? 0 : undefined}
            onKeyDown={
              variant === 'proposed'
                ? (e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(r.id);
                    }
                  }
                : undefined
            }
          >
            <div className="mrs-row">
              <Checkbox
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                aria-label={`Chọn ${r.name}`}
                className="mrs-selectCheck"
              />
              <div className="mrs-info">
                <span className="mrs-name">{r.name}</span>
                <div className="mrs-chips">
                  {r.chips.map((c) => (
                    <button key={c} type="button" className="mrs-chip">
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <Toggle checked={r.enabled} onChange={() => {}} ariaLabel={`Bật ${r.name}`} />
              <Button variant="ghost" size="sm" ripple={false} className="mrs-trash" aria-label={`Xóa ${r.name}`}>
                <Icon name="trash" size="xs" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

const NOTES: Record<Variant, React.ReactNode> = {
  current: (
    <>
      <strong>Hiện tại:</strong> nút Bật/Tắt/Xóa dài ngắn tùy chữ; checkbox 16px lệch với label sm;
      chỉ ô tick + tên là toggle được — vùng click hẹp.
    </>
  ),
  proposed: (
    <>
      <strong>Đề xuất:</strong> 1) <strong>cả card</strong> (kể cả padding) là vùng chọn — hover sáng toàn
      bộ card, <strong>không click animation</strong> (tắt ripple + lift) để tránh flick; 2) Bật/Tắt gom
      trong <strong>pill 40px</strong> (touch-target, box-sizing), cùng <code>min-width</code>; 3) delete
      luôn đỏ: "Xóa…" <strong>nền error-subtle thường trực</strong>, trash hover đỏ; 4) card edit mode nền
      <code>--color-field</code>; 5) "Chọn tất cả" font-size-base cân với box.
    </>
  ),
};

function App(): React.ReactElement {
  const [variant, setVariant] = useState<Variant>('proposed');
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="mrs-page">
      <header className="mrs-header">
        <h1 className="mrs-title">Resource edit mode — selection polish</h1>
        <div className="mrs-controls">
          <div className="mrs-seg" role="group" aria-label="Variant">
            <button type="button" aria-pressed={variant === 'current'} onClick={() => setVariant('current')}>
              Hiện tại
            </button>
            <button type="button" aria-pressed={variant === 'proposed'} onClick={() => setVariant('proposed')}>
              Đề xuất
            </button>
          </div>
          <div className="mrs-seg" role="group" aria-label="Theme">
            <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              Light
            </button>
            <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              Dark
            </button>
          </div>
        </div>
      </header>
      <p className="mrs-note">{NOTES[variant]}</p>
      <main className="mrs-stage">
        <Section variant={variant} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
