// Hoists host-page overlay roots (menus, sheets, dialogs, toasts) into a
// Tihoka shadow host while a Tihoka surface owns the fullscreen layer. Host
// popups either live outside the fullscreen subtree (can't paint at all —
// m.youtube BOTTOM-SHEET-CONTAINER in YTM-APP) or inside the slotted player
// container where the stage wrap (transform/overflow clip) breaks their
// positioning. Moving the outermost overlay root to a direct child of the
// shadow host — assigned to the "Tihoka-host-popup" slot — projects it into
// the popup stage at viewport level with its original page CSS intact.

const OVERLAY_NAME_RE =
  /dialog|modal|popup|popper|sheet|toast|snackbar|dropdown|drawer|lightbox|overlay[-_]?(container|root|host|portal|wrapper|pane)/i;
const OVERLAY_CONTAINER_RE = /overlay[-_]?(container|root|host|portal|wrapper)/i;
const MENU_NAME_RE = /menu/i;
const MENU_MIN_AREA_RATIO = 0.15;
const OVERLAY_ROLES = new Set([
  'menu',
  'dialog',
  'listbox',
  'alertdialog',
  'tooltip',
  'tree',
]);
const SEMANTIC_OVERLAY_QUERY =
  '[role="menu"],[role="dialog"],[role="listbox"],[role="alertdialog"],' +
  '[role="tooltip"],[role="tree"],[aria-modal="true"],dialog';
const OVERLAY_DESCENDANT_QUERY =
  `${SEMANTIC_OVERLAY_QUERY},` +
  '[class*="menu" i],[class*="popup" i],[class*="dialog" i],[class*="modal" i],' +
  '[class*="sheet" i],[class*="dropdown" i],[class*="toast" i],[class*="popover" i],' +
  '[class*="drawer" i],[class*="snackbar" i],[class*="lightbox" i]';
const OVERLAY_SLOT = 'Tihoka-host-popup';

const isSemanticOverlay = (el: HTMLElement): boolean => {
  const role = el.getAttribute('role');
  return (
    (role !== null && OVERLAY_ROLES.has(role)) ||
    el.getAttribute('aria-modal') === 'true' ||
    el.tagName === 'DIALOG'
  );
};

const overlaySignal = (el: HTMLElement): string =>
  `${el.tagName} ${typeof el.className === 'string' ? el.className : ''} ${el.id}`;

// "menu" alone is weak — host chrome like m.youtube .fullscreen-action-menu is
// persistent player UI, not a popup. Require popup evidence: a semantic
// descendant or a sheet-scale footprint.
const isMenuOverlay = (el: HTMLElement): boolean => {
  if (!MENU_NAME_RE.test(overlaySignal(el))) return false;
  if (el.querySelector(SEMANTIC_OVERLAY_QUERY) !== null) return true;
  const rect = el.getBoundingClientRect();
  return (
    rect.width * rect.height >=
    window.innerWidth * window.innerHeight * MENU_MIN_AREA_RATIO
  );
};

const isOverlayNamed = (el: HTMLElement): boolean =>
  OVERLAY_NAME_RE.test(overlaySignal(el)) || isMenuOverlay(el);

// '' position means unrendered. That only qualifies for container-type or
// semantic roots sitting inside `insideHost` — frameworks like Angular CDK
// append .cdk-overlay-container straight onto document.fullscreenElement,
// where unslotted light-DOM children never render until given a slot.
// Detached teardown leftovers (empty/static panes the framework is
// dismantling) must not pass: they are outside the host or only loosely
// named, so a ghost layer can never stick in the popup stage.
const isPositioned = (el: HTMLElement, insideHost?: HTMLElement): boolean => {
  const p = getComputedStyle(el).position;
  if (p === 'fixed' || p === 'absolute') return true;
  return (
    p === '' &&
    insideHost !== undefined &&
    insideHost.contains(el) &&
    (OVERLAY_CONTAINER_RE.test(overlaySignal(el)) || isSemanticOverlay(el))
  );
};

// Outermost positioned overlay-ish ancestor (inclusive). Host overlays nest
// (scrim > sheet > menu) — hoisting the outermost keeps them together.
export const overlayRoot = (
  node: Element,
  insideHost?: HTMLElement,
): HTMLElement | null => {
  let root: HTMLElement | null = null;
  let cur: Element | null = node;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    if (
      cur instanceof HTMLElement &&
      (isOverlayNamed(cur) || isSemanticOverlay(cur)) &&
      isPositioned(cur, insideHost)
    ) {
      root = cur;
    }
    cur = cur.parentElement;
  }
  return root;
};

// Watches the document while `shadowHost` owns the top layer and hoists
// overlay roots into it. Returns a cleanup that disconnects and restores
// each element to its original parent/sibling.
export function startHostOverlayHoist(shadowHost: HTMLElement): () => void {
  const hoisted = new Map<
    HTMLElement,
    { parent: Node | null; next: Node | null; pointerEvents: string }
  >();

  // NOTE: [data-tihoka-player-mode] must NOT be a closest() exclusion — Player
  // Mode sets data-tihoka-player-mode on <html> itself while active, which
  // would exclude every element in the document. The center style marker is
  // already covered by the script/style filter below.
  const isExcluded = (el: HTMLElement): boolean =>
    el === shadowHost ||
    el.contains(shadowHost) ||
    el.getAttribute('slot') === 'Tihoka-video' ||
    el.closest('#Tihoka-universal-panel-host,#Tihoka-manager-portal') !== null ||
    el.closest('[data-tihoka-id]') !== null ||
    el.closest('script,style,template,noscript') !== null;

  const adopt = (root: HTMLElement, parent: Node | null, next: Node | null): void => {
    // Keep the FIRST saved position for restore — the host framework may
    // re-insert the element elsewhere (Polymer morphs the sheet container
    // back into the player on each open); re-hoist without overwriting the
    // original anchor.
    if (!hoisted.has(root)) {
      hoisted.set(root, { parent, next, pointerEvents: root.style.pointerEvents });
    }
    root.setAttribute('slot', OVERLAY_SLOT);
    // The popup stage is pointer-events:none and slotted roots would
    // inherit that, so pin each root's own value — read AFTER slotting so
    // previously unrendered roots (framework-appended to the host) resolve
    // their stylesheet value. Pass-through containers
    // (cdk-overlay-container) keep passing clicks to Tihoka UI.
    root.style.pointerEvents = getComputedStyle(root).pointerEvents;
  };

  const hoist = (node: Element): void => {
    const root = overlayRoot(node, shadowHost);
    if (!root || !root.isConnected || isExcluded(root)) return;
    if (root.parentElement === shadowHost) {
      // Framework mounted its overlay root onto the fullscreen element
      // itself (Angular CDK appends .cdk-overlay-container to
      // document.fullscreenElement). Unslotted light-DOM children never
      // render — assigning the slot is all it needs; on cleanup it goes to
      // body, its usual mount point when no fullscreen is active.
      adopt(root, document.body, null);
      return;
    }
    adopt(root, root.parentNode, root.nextSibling);
    shadowHost.appendChild(root);
  };

  const observer = new MutationObserver((records) => {
    for (const rec of records) {
      if (rec.type === 'childList') {
        for (const node of Array.from(rec.addedNodes)) {
          if (!(node instanceof HTMLElement) || isExcluded(node)) continue;
          hoist(node);
          for (const desc of Array.from(node.querySelectorAll(OVERLAY_DESCENDANT_QUERY))) {
            hoist(desc);
          }
        }
      }
      // Host overlays often pre-exist empty and only populate/activate on
      // open — walk up from the mutation target to catch the container.
      if (rec.target instanceof Element) hoist(rec.target);
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'aria-hidden', 'hidden', 'open', 'role'],
  });

  return () => {
    observer.disconnect();
    for (const [el, saved] of hoisted) {
      el.removeAttribute('slot');
      el.style.pointerEvents = saved.pointerEvents;
      if (!(saved.parent instanceof Element) || !saved.parent.isConnected) continue;
      if (saved.next && saved.next.parentNode === saved.parent) {
        saved.parent.insertBefore(el, saved.next);
      } else {
        saved.parent.appendChild(el);
      }
    }
  };
}
