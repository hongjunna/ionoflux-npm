import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { npm, pack } from './package-tools.mjs';
const expected = ['LICENSE','NOTICE','README.ko.md','README.md','package.json',
  'dist/cjs/index.d.ts','dist/cjs/index.js','dist/cjs/package.json','dist/esm/index.d.ts','dist/esm/index.js'].sort();
const artifact = pack();
assert.deepEqual(artifact.files, expected, 'Unexpected package contents');
const manifest = JSON.parse(readFileSync('package.json'));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.license, 'PolyForm-Noncommercial-1.0.0');
assert.equal(manifest.dependencies, undefined);
for (const lifecycle of ['preinstall','install','postinstall','prepare','prepack']) assert.equal(manifest.scripts[lifecycle], undefined);
assert.match(readFileSync('LICENSE','utf8'), /PolyForm Noncommercial License 1\.0\.0/);
assert.equal(readFileSync('NOTICE','utf8').trim(), 'Required Notice: IonoFlux (https://ionoflux.runvia.app)');
const consumer = mkdtempSync(join(tmpdir(), 'ionoflux-consumer-'));
try {
  writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}');
  npm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', artifact.path], { cwd: consumer });
  const smoke = `
    const assert = require('node:assert/strict');
    const cjs = require('ionoflux');
    (async () => {
      const esm = await import('ionoflux');
      assert.equal(esm.Client, cjs.Client);
      assert.equal(esm.VERSION, '${manifest.version}');
      const client = new esm.Client({ fetch: async () => new Response('{"ok":true}') });
      assert.equal((await client.sources()).data.ok, true);
      client.close();
    })().catch(e => { console.error(e); process.exitCode = 1; });
  `;
  execFileSync(process.execPath, ['-e', smoke], { cwd: consumer, stdio: 'inherit' });
  for (const suffix of ['mts','cts']) writeFileSync(join(consumer, `consumer.${suffix}`),
    "import { Client, type APIResponse } from 'ionoflux'; const c = new Client(); const r: Promise<APIResponse> = c.sources(); void r; c.close();\n");
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '--strict', '--noEmit', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'consumer.mts', 'consumer.cts'], { cwd: consumer, stdio: 'inherit' });
  console.log(`Package allowlist, license, clean ESM/CJS install and TypeScript consumer checks passed (${artifact.filename})`);
} finally { rmSync(consumer, { recursive: true, force: true }); }
