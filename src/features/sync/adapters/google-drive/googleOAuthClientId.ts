export function googleOAuthClientId(): string {
  const value = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
  return value ?? '';
}
