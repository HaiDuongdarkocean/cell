/** Lookup targets that carry top-frame coordinates — synthesized elements
 *  dispatched by host-rendered surfaces (the remote cue panel). Shared so
 *  both the dictionaryPopup bridge (reader) and the subtitle cue-panel
 *  delegation (writer) can touch it without a feature-to-feature edge. */
const topAnchoredTargets = new WeakSet<object>();

export function markTopAnchoredTarget(target: object): void {
  topAnchoredTargets.add(target);
}

export function isTopAnchoredTarget(target: object | null | undefined): boolean {
  return target != null && topAnchoredTargets.has(target);
}
