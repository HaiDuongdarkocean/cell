// Mock Vite ?raw imports — returns a placeholder SVG string for tests.
// Includes common attributes (fill, stroke, aria-hidden) present on all registry
// SVGs so tests that check the SVG style contract pass without the real .svg files.
export default '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>';
