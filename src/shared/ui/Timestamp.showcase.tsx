import { Timestamp } from './Timestamp';
import type { ReactElement } from 'react';

const NOW = Date.now();
const PAST_5MIN = NOW - 5 * 60 * 1000;
const PAST_2HOURS = NOW - 2 * 60 * 60 * 1000;
const PAST_3DAYS = NOW - 3 * 24 * 60 * 60 * 1000;

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Timestamp value={PAST_5MIN} format="relative" />
      <Timestamp value={PAST_2HOURS} format="relative" />
      <Timestamp value={PAST_3DAYS} format="relative" />
      <Timestamp value={PAST_3DAYS} format="absolute" />
      <Timestamp value={PAST_3DAYS} format="time" />
      <Timestamp value={PAST_3DAYS} format="datetime" />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Timestamp',
  group: 'Display',
  order: 22,
};
