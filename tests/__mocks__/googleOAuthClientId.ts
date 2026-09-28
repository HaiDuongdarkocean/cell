/** Mock for the Google OAuth client id — source reads import.meta.env which
 *  is invalid in Jest's CJS transform. */
export function googleOAuthClientId(): string {
  return 'test-client-id';
}
