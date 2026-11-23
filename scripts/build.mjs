/**
 * Builds the loadable extension into dist/.
 *
 *   node scripts/build.mjs           one-off build
 *   node scripts/build.mjs --watch   rebuild on change
 *   node scripts/build.mjs --zip     build, then zip dist/ for the Chrome Web Store
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const watch = process.argv.includes('--watch');
const zip = process.argv.includes('--zip');

const STATIC_FILES = [
  'manifest.json',
  'icons',
  'popup/popup.html',
  'popup/popup.css',
  'popup/fonts.css',
  'popup/fonts',
  'popup/flags',
  'offscreen/offscreen.html',
];

function copyStatic() {
  for (const path of STATIC_FILES) {
    const target = join(dist, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, path), target, { recursive: true });
  }
}

const copyStaticPlugin = {
  name: 'copy-static',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0) copyStatic();
    });
  },
};

const shared = {
  absWorkingDir: root,
  bundle: true,
  outdir: dist,
  outbase: root,
  target: 'chrome116',
  legalComments: 'none',
  logLevel: 'info',
};

const configs = [
  {
    ...shared,
    // Content scripts cannot be ES modules; ship a single classic script.
    entryPoints: { content: 'content/index.js' },
    format: 'iife',
    loader: { '.css': 'text' },
  },
  {
    ...shared,
    entryPoints: ['background.js', 'popup/popup.js', 'offscreen/offscreen.js'],
    format: 'esm',
    plugins: [copyStaticPlugin],
  },
];

rmSync(dist, { recursive: true, force: true });

if (watch) {
  for (const config of configs) {
    const context = await esbuild.context(config);
    await context.watch();
  }
  console.log('Watching for changes… Load dist/ as the unpacked extension.');
} else {
  await Promise.all(configs.map((config) => esbuild.build(config)));

  if (zip) {
    const { version } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
    const archive = join(root, `inpulator-${version}.zip`);
    if (existsSync(archive)) rmSync(archive);
    execFileSync('zip', ['-qr', archive, '.'], { cwd: dist, stdio: 'inherit' });
    console.log(`Packaged ${archive}`);
  }
}
