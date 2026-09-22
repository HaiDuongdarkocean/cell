/**
 * Portal target that stays inside the trigger's root: shadow root → topmost
 * rendered element (keeps module CSS + z-index context); light DOM / portaled
 * iframe → that document's body. Mirrors the pattern used by Select and
 * ProfileMenu.
 */
export function getPortalContainer(node: Element | null): Element | DocumentFragment {
  if (!node) return document.body;
  const root = node.getRootNode();
  if (root instanceof ShadowRoot) {
    let el: Node = node;
    while (el.parentNode && el.parentNode !== root) {
      el = el.parentNode;
    }
    return el instanceof Element ? el : root;
  }
  return (root as Document).body ?? document.body;
}
