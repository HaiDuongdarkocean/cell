import { useState, type ReactElement } from 'react';
import { Pagination } from './Pagination';

export function Showcase(): ReactElement {
  const [page1, setPage1] = useState(0);
  const [page2, setPage2] = useState(4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Short range (5 pages)</h3>
        <Pagination current={page1} total={5} onChange={setPage1} />
      </div>

      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Long range with ellipsis (100 pages, current near middle)</h3>
        <Pagination current={page2} total={100} onChange={setPage2} />
      </div>

      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Without jump input</h3>
        <Pagination current={page1} total={10} onChange={setPage1} showJump={false} />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Pagination',
  description: 'Pagination control with first/prev/next/last, page numbers, ellipsis popup, and jump-to-page input. Token-driven, theme-agnostic.',
  level: 'molecules',
  category: 'Navigation',
  group: 'Shared UI — Navigation',
  order: 80,
};
