import type { ReactElement } from 'react';

interface IconProps {
  readonly size?: number;
  readonly className?: string;
}

function Svg({ size = 24, className, viewBox, children }: IconProps & { viewBox: string; children: ReactElement | readonly ReactElement[] }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={size}
      viewBox={viewBox}
      width={size}
      focusable="false"
      aria-hidden="true"
      fill="currentColor"
      style={{ pointerEvents: 'none', display: 'inherit' }}
      className={className}
    >
      {children}
    </svg>
  );
}

// === Header icons (24x24, viewBox 0 0 24 24) ===

export function MenuIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path d="M20 5H4a1 1 0 000 2h16a1 1 0 100-2Zm0 6H4a1 1 0 000 2h16a1 1 0 000-2Zm0 6H4a1 1 0 000 2h16a1 1 0 100-2Z" />
    </Svg>
  );
}

export function SearchIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path d="M11 2a9 9 0 105.641 16.01.966.966 0 00.152.197l3.5 3.5a1 1 0 101.414-1.414l-3.5-3.5a1 1 0 00-.197-.153A8.96 8.96 0 0020 11a9 9 0 00-9-9Zm0 2a7 7 0 110 14 7 7 0 010-14Z" />
    </Svg>
  );
}

export function VoiceSearchIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path d="M18.063 14.5a1 1 0 111.73 1A8.998 8.998 0 0113 19.942V22a1 1 0 11-2 0v-2.058A8.999 8.999 0 014.206 15.5l.866-.5.865-.5a7.002 7.002 0 0012.125 0ZM12 1a5 5 0 015 5v5a5 5 0 01-10 0V6a5 5 0 015-5ZM4.572 14.134a1 1 0 011.365.366l-1.731 1a1 1 0 01.366-1.366ZM12 3a3 3 0 00-3 3v5a3 3 0 106 0V6a3 3 0 00-3-3Z" />
    </Svg>
  );
}

export function CreateIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path d="M14 13h-3v3h-2v-3H6v-2h3V8h2v3h3v2zm3-7H3v12h14v-6.39l4 2.4V8.99l-4 2.4V6z" />
    </Svg>
  );
}

export function NotificationsIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path d="M16 19a4 4 0 11-8 0H4.765C3.21 19 2.25 17.304 3.05 15.97l1.806-3.01A1 1 0 005 12.446V8a7 7 0 0114 0v4.446c0 .181.05.36.142.515l1.807 3.01c.8 1.333-.161 3.029-1.716 3.029H16ZM12 3a5 5 0 00-5 5v4.446a3 3 0 01-.428 1.543L4.765 17h14.468l-1.805-3.01A3 3 0 0117 12.445V8a5 5 0 00-5-5Zm-2 16a2 2 0 104 0h-4Z" />
    </Svg>
  );
}

// === Action icons (18x18, viewBox 0 0 18 18) ===

export function LikeIcon({ size = 18, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 18 18">
      <path d="m7.748.854.779.13a3 3 0 012.44 3.588L10.5 6.75h3.046a2.748 2.748 0 012.204 4.387l.015.066A2.862 2.862 0 0115 13.874v.033c0 .227-.037.452-.109.668l-.08.21a2.815 2.815 0 01-2.59 1.715H9.516l-.294-.005a9.002 9.002 0 01-3.918-1.041l-.256-.142-.204-.116a1.502 1.502 0 00-.55-.186L4.102 15H2.625l-.116-.006a1.126 1.126 0 01-1.003-1.005l-.006-.114v-4.5c0-.62.504-1.124 1.125-1.124h1.342a.75.75 0 00.66-.395l.048-.107 2.24-6.403a.75.75 0 01.833-.491ZM6.09 8.243A2.25 2.25 0 013.967 9.75H3v3.749h1.1a3 3 0 011.49.395l.202.116a7.503 7.503 0 003.724.99h2.703c.566 0 1.07-.363 1.248-.9a.61.61 0 00.032-.193v-.655l.44-.439a1.36 1.36 0 00.363-1.272l-.014-.065-.157-.675.413-.556a1.248 1.248 0 00-.999-1.995H10.5a1.501 1.501 0 01-1.467-1.815L9.5 4.257a1.5 1.5 0 00-1.22-1.794l-.157-.026L6.09 8.243Z" />
    </Svg>
  );
}

export function DislikeIcon({ size = 18, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 18 18">
      <path d="m8.482 1.5.294.005a9.01 9.01 0 013.918 1.04l.257.143.203.116c.17.097.357.16.55.185l.194.012h1.477l.115.006c.53.054.95.475 1.004 1.005l.006.114v4.499c0 .621-.504 1.125-1.125 1.125h-1.343a.75.75 0 00-.66.395l-.048.107-2.24 6.402a.75.75 0 01-.832.491l-.78-.13a3 3 0 01-2.439-3.587L7.5 11.25H4.454a2.749 2.749 0 01-2.683-2.151 2.762 2.762 0 01.479-2.237l-.016-.065A2.862 2.862 0 013 4.125v-.032c0-.227.037-.453.108-.668l.08-.211A2.816 2.816 0 015.78 1.5h2.703ZM5.78 3c-.566 0-1.069.362-1.248.9a.613.613 0 00-.031.193v.654l-.44.44c-.333.332-.47.813-.364 1.271l.015.065.157.675-.413.557a1.248 1.248 0 00.999 1.995H7.5a1.501 1.501 0 011.467 1.815L8.5 13.742a1.5 1.5 0 001.22 1.794l.157.027 2.031-5.806a2.25 2.25 0 012.124-1.507H15V4.501h-1.102a3.001 3.001 0 01-1.489-.396l-.202-.116A7.504 7.504 0 008.482 3H5.78Z" />
    </Svg>
  );
}

export function ShareIcon({ size = 18, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 18 18">
      <path d="M7.5 2.369v3.263c-4.394.18-6.529 3.25-6.733 9.795-.011.354.433.513.659.24 2.347-2.838 3.262-3.258 6.074-3.291v3.259a.75.75 0 001.235.572l8.515-7.205-8.515-7.205a.75.75 0 00-1.235.572ZM9 7.07V3.986l5.928 5.016L9 14.017v-3.159l-1.517.018c-1.452.017-2.69.127-3.898.768-.35.186-.683.41-1.01.67.266-1.46.687-2.543 1.222-3.32.797-1.156 1.956-1.789 3.765-1.863L9 7.07Z" />
    </Svg>
  );
}

export function SaveIcon({ size = 18, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 18 18">
      <path d="M14.25 1.5H3.75A1.5 1.5 0 002.25 3v12.665c0 .95 1.037 1.538 1.852 1.049L9 13.774l4.898 2.94a1.223 1.223 0 001.852-1.049V3a1.5 1.5 0 00-1.5-1.5ZM3.75 15.175V3h10.5v12.175l-4.864-2.918L9 12.025l-.386.232-4.864 2.918Z" />
    </Svg>
  );
}

export function DownloadIcon({ size = 18, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 18 18">
      <path d="M9 1.5a.75.75 0 00-.75.75v8.69L5.03 7.72l-.056-.052A.75.75 0 003.97 8.78L9 13.81l5.03-5.03a.75.75 0 10-1.06-1.06l-3.22 3.22V2.25A.75.75 0 009 1.5ZM14.25 15H3.75a.75.75 0 100 1.5h10.5a.75.75 0 100-1.5Z" />
    </Svg>
  );
}

// === Sidebar icons (24x24) ===

export function HomeIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path d="M4 21V10.08l8-6.96 8 6.96V21h-6v-6h-4v6H4Zm1-1h4v-6h6v6h4v-9.54l-7-6.12-7 6.12V20Z" />
    </Svg>
  );
}

export function ShortsIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path d="M10 14.65v-5.3L15 12l-5 2.65Zm7.77-4.33c-.23-1.76-1.05-3.19-2.34-4.1-.95-.67-1.7-.74-2.27-.4-.45.27-.64.81-.58 1.55l.12 1.35c.06.7-.2 1.05-.95 1.18l-1.65.3c-1.05.2-1.5.6-1.6 1.36-.1.7.2 1.2.9 1.7.6.43 1.3.6 2.1.5l.4-.07c.66-.12 1.04.05 1.3.6l.6 1.13c.32.6.7.95 1.26 1.04.46.07.97-.1 1.45-.5 1.1-.9 1.65-2.3 1.42-3.97Z" />
    </Svg>
  );
}

export function SubscriptionsIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path d="M10 18v-6l5 3-5 3Zm7-15H7v1h10V3Zm3 3H4v1h16V6Zm2 3H2v12h20V9ZM3 10h18v10H3V10Z" />
    </Svg>
  );
}

export function LibraryIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path d="M11 7l6 3.5-6 3.5V7Zm7 13H4V6H3v15h15v-1Zm3-2H6V3h15v15ZM7 17h13V4H7v13Z" />
    </Svg>
  );
}

export function HistoryIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path d="M14.97 16.95L10 13.87V7h2v5.76l4.03 2.49-1.06 1.7ZM12 3a9 9 0 1 0 9 9h-1a8 8 0 1 1-8-8V3Zm-1 2v1h2V5h-2Zm0 14v1h2v-1h-2Z" />
    </Svg>
  );
}

// === Additional sidebar / action icons (24x24, fill currentColor) ===

export function ChevronRightIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M9.4 18.4 8 17l5-5-5-5 1.4-1.4L15.8 12l-6.4 6.4Z" />
    </Svg>
  );
}

export function YouIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-3.33 0-6 1.34-6 3v1h12v-1c0-1.66-2.67-3-6-3Z" />
    </Svg>
  );
}

export function PlaylistsIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M14 10H3v2h11v-2Zm0-4H3v2h11V6ZM3 16h7v-2H3v2Zm11.41 1.41L17 14.83V20h2v-5.17l2.59 2.58L23 16l-5-5-5 5 1.41 1.41Z" />
    </Svg>
  );
}

export function YourVideosIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M10 8v8l6-4-6-4Zm-6 11h16V5H4v14ZM5 6h14v12H5V6Z" />
    </Svg>
  );
}

export function WatchLaterIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm.5-13H11v6l5 3 .75-1.25-4.25-2.5V7Z" />
    </Svg>
  );
}

export function LikedIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M1 21h4V9H1v12Zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2Z" />
    </Svg>
  );
}

export function TrendingIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="m16 6 2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6Z" />
    </Svg>
  );
}

export function MusicIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 4v10.55A4 4 0 1 0 14 18V7h4V4h-6Z" />
    </Svg>
  );
}

export function MoviesIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M18 4 2 12l16 8 4-8-4-8Zm-1.53 2.16L19.38 11H11.9l4.57-4.84ZM4.62 12l3.07-3.25L12.27 11H4.62Zm12.85 5.84L11.9 13h7.48l-1.91 4.84Z" />
    </Svg>
  );
}

export function GamingIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M10 12H8v2H6v-2H4v-2h2V8h2v2h2v2Zm7 1.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM21 6v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Zm-2 0H5v12h14V6Z" />
    </Svg>
  );
}

export function LiveIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M6 12a6 6 0 0 1 6-6V4a8 8 0 0 0-8 8 8 8 0 0 0 8 8v-2a6 6 0 0 1-6-6Zm6-2v4l3 1.5.5-1L13 13V10h-1Z" />
    </Svg>
  );
}

export function SettingsIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58ZM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2Z" />
    </Svg>
  );
}

export function PlusIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z" />
    </Svg>
  );
}

export function BellIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2Zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Z" />
    </Svg>
  );
}

export function MoreIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    </Svg>
  );
}

export function VerifiedIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 2 9.91 4.91 6.2 4.2l-.71 3.71L2 9.91 4.2 13.5 2 17.09l3.49 1.6.71 3.71 3.71-.71L12 24l2.09-2.91 3.71.71.71-3.71L22 17.09 19.8 13.5 22 9.91l-3.49-1.6L17.8 4.2l-3.71.71L12 2Zm-1.2 14L7 12.2l1.4-1.4 2.4 2.4 4.8-4.8L17 9.8 10.8 16Z" />
    </Svg>
  );
}

export function ThanksIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 21.35 10.55 20A45 45 0 0 1 3 12.5C3 8.42 5.42 6 8.5 6c1.74 0 3.41.81 4.5 2.09C14.09 6.81 15.76 6 17.5 6 20.58 6 23 8.42 23 12.5c0 1.47-.5 2.95-1.27 4.32-.26-.46-.6-.88-1-1.24.5-.95.77-1.93.77-3.08 0-2.97-1.74-4.5-3.5-4.5-1.3 0-2.5.7-3.2 1.8L12 11.51l-1.8-1.7C9.5 8.7 8.3 8 7 8 5.24 8 3.5 9.53 3.5 12.5c0 2.97 3.62 6.85 8.5 11.35Z" />
    </Svg>
  );
}

export function ClipIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M9.64 7.64a3 3 0 1 0-2.12 5.12l1.06-1.06a1.5 1.5 0 1 1 1.06-2.56l1.06-1.06a3 3 0 0 0-1.06-.44Zm7.07 7.07a3 3 0 1 0-2.12 5.12l1.06-1.06a1.5 1.5 0 1 1 1.06-2.56l1.06-1.06a3 3 0 0 0-1.06-.44ZM6.46 6.46l1.06 1.06 9.9 9.9-1.06 1.06-9.9-9.9-1.06-1.06Z" />
    </Svg>
  );
}

export function ReportIcon({ size, className }: IconProps): ReactElement {
  return (
    <Svg size={size} className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6Z" />
    </Svg>
  );
}

// === YouTube Logo ===

export function YouTubeLogo({ className }: { readonly className?: string }): ReactElement {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <svg width="28" height="20" viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M14.4848 20C14.4848 20 23.5695 20 25.8229 19.4C27.0917 19.06 28.0459 18.08 28.3808 16.87C29 14.65 29 9.98 29 9.98C29 9.98 29 5.34 28.3808 3.14C28.0459 1.9 27.0917 0.94 25.8229 0.61C23.5695 0 14.4848 0 14.4848 0C14.4848 0 5.42037 0 3.17711 0.61C1.9286 0.94 0.954148 1.9 0.59888 3.14C0 5.34 0 9.98 0 9.98C0 9.98 0 14.65 0.59888 16.87C0.954148 18.08 1.9286 19.06 3.17711 19.4C5.42037 20 14.4848 20 14.4848 20Z" fill="#FF0033" />
        <path d="M19 10L11.5 5.75V14.25L19 10Z" fill="white" />
      </svg>
      <span style={{ fontFamily: "'Roboto', Arial, sans-serif", fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '-0.05em', lineHeight: 1 }}>YouTube</span>
    </div>
  );
}
