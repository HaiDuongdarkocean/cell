/**
 * Re-pins a viewport-anchored layer inside the Player Mode stage box:
 * position:fixed/sticky → absolute so the element's own offsets resolve
 * against the stage (the player container, now the containing block) instead
 * of the viewport. Authored anchors are preserved — a bottom control bar
 * keeps its `bottom:0` and lands on the stage's bottom edge; forcing
 * `inset:0` would pin it to the top instead.
 */
export function pinLayerInsideStage(el: HTMLElement): void {
  const pos = getComputedStyle(el).position;
  if (pos !== 'fixed' && pos !== 'sticky') return;
  el.style.setProperty('position', 'absolute', 'important');
}
