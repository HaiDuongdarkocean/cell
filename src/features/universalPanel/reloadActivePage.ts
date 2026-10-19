/** Wrapper so tests can assert the reload without jsdom stubbing location. */
export function reloadActivePage(): void {
  location.reload();
}
