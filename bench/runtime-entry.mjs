// Entry for Node / Bun / Deno: `<runtime> bench/runtime-entry.mjs <timeMs>` prints JSON.
import * as dotvar from '../dist/index.js';

import { runBench } from './portable.mjs';

const time = Number(globalThis.process?.argv?.[2] ?? globalThis.Deno?.args?.[0] ?? 1000);
console.log(JSON.stringify(runBench(dotvar, time)));
