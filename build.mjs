// Build script for the Jyutping extension.
// Bundles ES modules under src/ into the flat files the extension loads
// (content.js at the repo root, referenced by manifest.json).
//
// Usage:
//   node build.mjs           one-off build
//   node build.mjs --watch   rebuild on change

import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const common = {
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  charset: 'utf8',
  // Keep output readable: the extension ships unbundled-looking source and
  // it is reviewed by the Chrome Web Store. No minification.
  minify: false,
  legalComments: 'inline',
  logLevel: 'info',
};

const targets = [
  { in: 'src/content/index.js', out: 'content.js' },
];

if (watch) {
  for (const t of targets) {
    const ctx = await esbuild.context({ ...common, entryPoints: [t.in], outfile: t.out });
    await ctx.watch();
  }
  console.log('[build] watching for changes...');
} else {
  for (const t of targets) {
    await esbuild.build({ ...common, entryPoints: [t.in], outfile: t.out });
    console.log(`[build] ${t.in} -> ${t.out}`);
  }
}
