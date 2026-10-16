/* global chrome */
// Evaluate an expression inside the Tihoka service worker of the running
// debug session. Usage: node sw-eval.mjs "<js>"
import { chromium } from '@playwright/test';
import { requireSession } from '../session.mjs';

const session = requireSession();
const expr = process.argv[2];
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${session.port}`);
const ctx = browser.contexts()[0];
const sw = ctx.serviceWorkers().find((w) => w.url().includes('ifceodog'));
if (!sw) { console.log('NO_SW'); process.exit(1); }
const result = await sw.evaluate(new Function(`return (${expr})`));
console.log(JSON.stringify(result, null, 1));
await browser.close();
