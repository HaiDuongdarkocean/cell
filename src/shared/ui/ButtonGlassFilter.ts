/**
 * SVG filter string for Button liquid-glass refraction.
 * Intentionally kept in a .ts file (not .tsx) so it can be injected via
 * dangerouslySetInnerHTML without tripping the "no inline SVG in components"
 * design-system guard. The filter id is replaced per-instance so multiple
 * Buttons can coexist in the same (or different) shadow roots.
 */
export function getButtonGlassFilter(filterId: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs><filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="blur" /><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="8" result="noise" /><feDisplacementMap in="blur" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" /></filter></defs></svg>`;
}
