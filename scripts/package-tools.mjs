import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
export function npm(args, options = {}) {
  if (!process.env.npm_execpath) throw new Error('Run this command through npm run');
  return execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
    encoding: 'utf8', env: { ...process.env, npm_config_cache: process.env.npm_config_cache ?? join(tmpdir(), 'ionoflux-package-cache') }, ...options,
  });
}
export function pack(destination = mkdtempSync(join(tmpdir(), 'ionoflux-pack-'))) {
  const data = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', destination]));
  const [result] = Array.isArray(data) ? data : Object.values(data);
  const path = resolve(destination, result.filename), bytes = readFileSync(path);
  return { path, filename: result.filename, files: result.files.map(f => f.path).sort(),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
}
