// serializeNodes — PhraseNode AST → human-readable string cho lookup log.
//
// Output dạng: "literal(make) + alt([slot(person,2)], [literal(yourself)], [slot(object,2), literal(out)])"
// Giúp đọc log phát hiện parser bug (out misplaced, slot maxTokens sai, v.v.)
// mà không cần dump JSON AST.

import type { PhraseNode } from '@/features/dictionary/logic/phraseTemplateParser';

/** Serialize một PhraseNode thành string ngắn gọn. */
export function serializeNode(node: PhraseNode): string {
  switch (node.type) {
    case 'literal':
      return node.inflectableVerb
        ? `literal(${node.value}+infl)`
        : `literal(${node.value})`;
    case 'slot':
      return `slot(${node.kind},${node.maxTokens})`;
    case 'optional':
      return `opt(${serializeNodes(node.children)})`;
    case 'alternative':
      return `alt(${node.branches.map((b) => `[${serializeNodes(b)}]`).join(', ')})`;
  }
}

/** Serialize một chuỗi PhraseNode thành "a + b + c". */
export function serializeNodes(nodes: readonly PhraseNode[]): string {
  return nodes.map(serializeNode).join(' + ');
}
