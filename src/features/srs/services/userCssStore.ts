import { getStorage, setStorage } from '@/shared/lib/chrome-apis';

const SRS_USER_CSS_KEY = 'srsUserCss';

/** Load the user's custom CSS for the srs-study page. */
export async function getSrsUserCss(): Promise<string> {
  const data = await getStorage<Record<string, string>>(SRS_USER_CSS_KEY);
  return data[SRS_USER_CSS_KEY] ?? '';
}

/** Persist the user's custom CSS for the srs-study page. */
export async function setSrsUserCss(css: string): Promise<void> {
  await setStorage({ [SRS_USER_CSS_KEY]: css });
}
