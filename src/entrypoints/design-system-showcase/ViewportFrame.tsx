import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './ViewportFrame.module.css';

export type ViewportWidth = 'full' | 320 | 360 | 375 | 390 | 430 | 600 | 768 | 840 | 1024 | 1200 | 1280 | 1920;

export interface ViewportPreset {
  label: string;
  value: ViewportWidth;
  height?: number;
}

export const VIEWPORT_PRESETS: readonly ViewportPreset[] = [
  { label: '320', value: 320, height: 568 },
  { label: '360', value: 360, height: 800 },
  { label: '375', value: 375, height: 667 },
  { label: '390', value: 390, height: 844 },
  { label: '430', value: 430, height: 932 },
  { label: '600', value: 600, height: 750 },
  { label: '768', value: 768, height: 1024 },
  { label: '840', value: 840, height: 850 },
  { label: '1024', value: 1024, height: 768 },
  { label: '1200', value: 1200, height: 850 },
  { label: '1280', value: 1280, height: 800 },
  { label: '1920', value: 1920, height: 1080 },
  { label: 'Fit', value: 'full' },
] as const;

/** Renders children inside an iframe of the given width so that
 *  @media queries respond to the iframe viewport, not the parent. */
export function ViewportFrame({
  width,
  height,
  theme,
  children,
}: {
  width: ViewportWidth;
  height?: number;
  theme?: string;
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

      doc.documentElement.lang = document.documentElement.lang || 'en';
      doc.title = document.title;

      const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
      styleNodes.forEach((node) => {
        doc.head.appendChild(node.cloneNode(true));
      });

      const parentTheme = document.documentElement.getAttribute('data-theme');
      if (parentTheme) doc.documentElement.setAttribute('data-theme', parentTheme);
      const parentPreset = document.documentElement.getAttribute('data-preset');
      if (parentPreset) doc.documentElement.setAttribute('data-preset', parentPreset);

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

      const hidden =
        'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
      const main = doc.createElement('main');
      const h1 = doc.createElement('h1');
      h1.textContent = iframe.title || 'Preview';
      h1.style.cssText = hidden;
      const h2 = doc.createElement('h2');
      h2.textContent = doc.title;
      h2.style.cssText = hidden;
      main.append(h1, h2);
      doc.body.appendChild(main);

      setPortalTarget(main);
    };

    iframe.addEventListener('load', setup);
    if (iframe.contentDocument?.readyState === 'complete') setup();

    return () => iframe.removeEventListener('load', setup);
  }, []);

  // Mirror theme + preset from the parent document so palette-scoped tokens
  // ([data-preset][data-theme]) resolve inside the iframe too.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const mirror = (): void => {
      const parent = document.documentElement;
      const parentTheme = parent.getAttribute('data-theme');
      const parentPreset = parent.getAttribute('data-preset');
      if (parentTheme) doc.documentElement.setAttribute('data-theme', parentTheme);
      if (parentPreset) doc.documentElement.setAttribute('data-preset', parentPreset);
    };

    if (theme) doc.documentElement.setAttribute('data-theme', theme);
    mirror();

    const observer = new MutationObserver(mirror);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-preset'] });
    return () => observer.disconnect();
  }, [theme]);

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
  const fill = width === 'full' && height === undefined;
  const style: React.CSSProperties = { width: frameWidth };
  if (height) style.height = `${height}px`;
  else if (!fill) style.height = '100%';

  return (
    <div className={`${styles.frame}${fill ? ` ${styles.frameFill}` : ''}`} style={style}>
      <iframe ref={iframeRef} className={styles.iframe} title="Viewport preview" />
      {portalTarget && createPortal(children, portalTarget)}
    </div>
  );
}
