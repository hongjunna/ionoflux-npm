import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { pack } from './package-tools.mjs';
export function parseTag(ref, version) {
  const match = /^refs\/tags\/npm-(stage-)?v(\d+\.\d+\.\d+)$/.exec(ref ?? '');
  assert.ok(match && match[2] === version, 'An exact version tag is required');
  return match[1] ? 'npm-stage' : 'npm';
}
function git(...args) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
async function github(path) {
  assert.ok(process.env.GH_TOKEN, 'GitHub token required for source verification');
  const r = await fetch(`https://api.github.com/repos/hongjunna/ionoflux-npm/${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000),
  });
  assert.equal(r.status, 200, `GitHub verification failed (${r.status})`); return r.json();
}
export function validateEnvironment(environment) {
  assert.equal(environment.can_admins_bypass, false, 'Environment must disallow administrator bypass');
  const rule = environment.protection_rules?.find(r => r.type === 'required_reviewers');
  assert.ok(rule?.reviewers?.some(r => r.type === 'User' && r.reviewer?.login === 'hongjunna'), 'Owner environment approval required');
  assert.equal(environment.deployment_branch_policy?.custom_branch_policies, true, 'Tag restriction required');
}
async function gate(version) {
  assert.equal(process.env.GITHUB_EVENT_NAME, 'push', 'Only tag pushes can publish');
  assert.equal(process.env.GITHUB_REPOSITORY, 'hongjunna/ionoflux-npm');
  const environment = parseTag(process.env.GITHUB_REF, version);
  const sha = git('rev-parse', 'HEAD'); assert.equal(sha, process.env.GITHUB_SHA);
  git('merge-base', '--is-ancestor', sha, 'origin/main');
  const runs = await github(`actions/workflows/ci.yml/runs?head_sha=${sha}&branch=main&event=push&per_page=100`);
  assert.ok(runs.workflow_runs?.some(r => r.head_sha === sha && r.head_branch === 'main' && r.event === 'push' && r.conclusion === 'success'), 'Successful main push CI required');
  validateEnvironment(await github(`environments/${environment}`));
  const policies = await github(`environments/${environment}/deployment-branch-policies`);
  const expected = environment === 'npm' ? 'npm-v*' : 'npm-stage-v*';
  assert.ok(policies.branch_policies?.some(p => p.type === 'tag' && p.name === expected), 'Matching environment tag policy required');
  const response = await fetch(`https://registry.npmjs.org/ionoflux/${version}`, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 404, 'Version must be absent; registry errors fail closed');
  console.log(`Verified ${environment} source, main CI, approval protection and unpublished version`);
}
export async function main(command) {
  const pkg = JSON.parse(readFileSync('package.json'));
  assert.equal(pkg.name, 'ionoflux');
  const path = `.github/release/${pkg.version}.json`;
  if (command === 'gate') return gate(pkg.version);
  if (command === 'verify' || command === 'prepare') {
    const a = pack(), b = pack();
    assert.equal(a.sha256, b.sha256, 'Repeated packs must be identical');
    assert.equal(a.integrity, b.integrity);
    const manifest = { name: pkg.name, version: pkg.version, node: '24.19.0', npm: '12.0.2', filename: a.filename, sha256: a.sha256, integrity: a.integrity };
    if (command === 'prepare') {
      assert.equal(process.version, `v${manifest.node}`, 'Use the fixed release Node version');
      assert.equal((process.env.npm_config_user_agent ?? '').split(' ')[0], `npm/${manifest.npm}`, 'Use the fixed release npm version');
      writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
    } else {
      const expected = JSON.parse(readFileSync(path));
      assert.equal(expected.name, manifest.name); assert.equal(expected.version, manifest.version);
      assert.equal(expected.filename, a.filename); assert.equal(expected.sha256, a.sha256, 'Reviewed sha256 differs');
      assert.equal(expected.integrity, a.integrity, 'Reviewed integrity differs');
      mkdirSync('artifacts', { recursive: true });
      const output = pack('artifacts'); assert.equal(output.sha256, expected.sha256);
      writeFileSync('artifacts/SHA256SUMS', `${a.sha256}  ${a.filename}\n`);
    }
    console.log(`${pkg.version} reproducible package: ${a.sha256}`); return;
  }
  throw new Error('Expected prepare, verify or gate');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
