// Flow runner — divide and conquer.
//   node run.mjs <site> [flow|--list|all] [--url <u>] [--settle <ms>]
//
// <site>  = sites/<slug>.mjs  (config: match, url, settleMs, steps, flows)
// <flow>  = a named step list — site flows win over dbg/flows.mjs globals.
//           No flow → runs all flows visible to that site.
// Steps   = named fns (env, ...args) — site `steps` win over dbg/steps.mjs.
import { connectBrowser } from './dbg/browser.mjs';
import * as dbgSteps from './dbg/steps.mjs';
import { flows as dbgFlows } from './dbg/flows.mjs';

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : null;
};
const positional = argv.filter((a, i) => !a.startsWith('--')
  && argv[i - 1] !== '--url' && argv[i - 1] !== '--settle');
const [site, flowArg] = positional;

if (!site) {
  console.log('usage: node run.mjs <site> [flow|--list|all] [--url u] [--settle ms]');
  process.exit(1);
}

const mod = await import(`./sites/${site}.mjs`).catch(() => {
  console.log(`no site "${site}" — create script/sites/${site}.mjs`);
  process.exit(1);
});

const steps = { ...dbgSteps, ...(mod.steps ?? {}) };
const flows = { ...dbgFlows, ...(mod.flows ?? {}) };

if (argv.includes('--list')) {
  console.log(`${site} flows:`, Object.keys(flows).join(', '));
  console.log(`${site} steps:`, Object.keys(steps).join(', '));
  process.exit(0);
}

const { session, ctx } = await connectBrowser();
const env = {
  site,
  match: mod.match ?? site,
  url: flag('--url') ?? mod.url,
  settleMs: Number(flag('--settle') ?? mod.settleMs ?? 0),
  session,
  ctx,
  page: null,
};

const names = !flowArg || flowArg === 'all' ? Object.keys(flows) : [flowArg];
for (const name of names) {
  const flow = flows[name];
  if (!flow) { console.log(`unknown flow "${name}" for ${site}`); process.exit(1); }
  console.log(`FLOW ${site}/${name}`);
  for (const spec of flow) {
    const [stepName, ...args] = Array.isArray(spec) ? spec : [spec];
    const fn = steps[stepName];
    if (typeof fn !== 'function') {
      throw new Error(`unknown step "${stepName}" in ${site}/${name}`);
    }
    await fn(env, ...args);
  }
}
console.log('DONE');
process.exit(0);
