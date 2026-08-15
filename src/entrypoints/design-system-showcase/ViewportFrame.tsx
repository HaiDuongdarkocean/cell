import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './ViewportFrame.module.css';

export type ViewportWidth = 'full' | 320 | 360 | 390 | 430 | 768 | 1024 | 1280 | 1920;

export interface ViewportPreset {
  label: string;
  value: ViewportWidth;
  height?: number;
}

export const VIEWPORT_PRESETS: readonly ViewportPreset[] = [
  { label: '320', value: 320, height: 568 },
  { label: '360', value: 360, height: 800 },
  { label: '390', value: 390, height: 844 },
  { label: '430', value: 430, height: 932 },
  { label: '768', value: 768, height: 1024 },
  { label: '1024', value: 1024, height: 768 },
  { label: '1280', value: 1280, height: 800 },
  { label: '1920', value: 1920, height: 1080 },
  { label: 'Fit', value: 'full' },
] as const;

/** Renders children inside an iframe of the given width so that
 *  @media queries respond to the iframe viewport, not the parent. */
export function ViewportFrame({
  width,
  height,
  children,
}: {
  width: ViewportWidth;
  height?: number;
  children: ReactNode;
}): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const setup = (): void => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Clone all stylesheets from parent document
      const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
      styleNodes.forEach((node) => {
        doc.head.appendChild(node.cloneNode(true));
      });

      // Sync theme attribute (dark mode)
      const parentTheme = document.documentElement.getAttribute('data-theme');
      if (parentTheme) doc.documentElement.setAttribute('data-theme', parentTheme);

      // Reset body
      doc.body.style.margin = '0';
      doc.body.style.padding = '0';
      doc.body.style.background = 'var(--color-background)';
      doc.body.style.color = 'var(--color-text-primary)';
      doc.body.style.fontFamily = 'var(--font-family-body)';
      doc.body.style.overflowY = 'auto';

      // Override .root constraints so content flows naturally inside iframe
      const override = doc.createElement('style');
      override.textContent = '[class*="root"]{height:auto!important;overflow:visible!important;}';
      doc.head.appendChild(override);

      // Reset scroll position (browser may restore previous scroll)
      doc.documentElement.scrollTop = 0;
      doc.body.scrollTop = 0;

      setPortalTarget(doc.body);
    };

    iframe.addEventListener('load', setup);
    if (iframe.contentDocument?.readyState === 'complete') setup();

    return () => iframe.removeEventListener('load', setup);
  }, []);

  // Reset scroll inside iframe after content is portal'd in
  useEffect(() => {
    if (!portalTarget) return;
    const id = setTimeout(() => {
      portalTarget.scrollTop = 0;
      const content = portalTarget.querySelector('[class*="content"]');
      if (content) content.scrollTop = 0;
    }, 100);
    return () => clearTimeout(id);
  }, [portalTarget]);

  const frameWidth = width === 'full' ? '100%' : `${width}px`;
  const frameHeight = height ? `${height}px` : '100%';

  return (
    <div className={styles.frame} style={{ width: frameWidth, height: frameHeight }}>
      <iframe ref={iframeRef} className={styles.iframe} title="Viewport preview" />
      {portalTarget && createPortal(children, portalTarget)}
    </div>
  );
}
