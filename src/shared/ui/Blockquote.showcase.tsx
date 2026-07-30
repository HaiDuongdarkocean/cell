import { Blockquote } from './Blockquote';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Blockquote>
        The best way to predict the future is to invent it.
      </Blockquote>
      <Blockquote variant="bordered" citation="Alan Kay">
        The best way to predict the future is to invent it.
      </Blockquote>
      <Blockquote cite="https://example.com" citation="Example Source">
        Simple things should be simple, complex things should be possible.
      </Blockquote>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Blockquote',
  description: 'Blockquote with default and bordered variants, citation support. Use for quoting text.',
  group: 'Display',
  order: 23,
};
