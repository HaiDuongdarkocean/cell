import { MasteryBadge } from './MasteryBadge';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <MasteryBadge progress={10} />
        <MasteryBadge progress={35} />
        <MasteryBadge progress={60} />
        <MasteryBadge progress={100} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <MasteryBadge progress={45} showProgress={false} />
        <MasteryBadge progress={80} showProgress={false} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <MasteryBadge progress={25} icon="spinner">Loading</MasteryBadge>
        <MasteryBadge progress={90}>Vocab</MasteryBadge>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'MasteryBadge',
  level: 'atoms',
  category: 'Feedback',
  group: 'Domain — Learning',
  order: 93,
};
