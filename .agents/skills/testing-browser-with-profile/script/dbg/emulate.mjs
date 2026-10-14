// Device emulation via CDP — same mechanism as DevTools device toolbar.
// If the user has DevTools device mode open on the page it owns the
// emulation; close it or re-run emulate() to take it back.

export const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36';

export const PORTRAIT = { width: 375, height: 667 };
export const LANDSCAPE = { width: 667, height: 375 };

export async function emulate(ctx, page, { width, height, dpr = 2, mobile = true, ua = MOBILE_UA }) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: dpr, mobile,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  if (ua) await cdp.send('Emulation.setUserAgentOverride', { userAgent: ua });
}

export async function clearEmulation(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
}
