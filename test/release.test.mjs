import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTag, validateEnvironment } from '../scripts/release.mjs';
test('release tags are exact and route to their protected environment', () => {
  assert.equal(parseTag('refs/tags/npm-v0.1.3', '0.1.3'), 'npm');
  assert.equal(parseTag('refs/tags/npm-stage-v0.1.3', '0.1.3'), 'npm-stage');
  for (const ref of ['refs/heads/main','refs/tags/npm-v0.1.2','refs/tags/npm-v0.1.3-rc.1','refs/tags/npm-v0.1.3junk','refs/tags/v0.1.3',undefined])
    assert.throws(() => parseTag(ref, '0.1.3'));
});
test('missing reviewer or bypass protection fails closed', () => {
  const config = { can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { login: 'hongjunna' } }] }], deployment_branch_policy: { custom_branch_policies: true } };
  validateEnvironment(config);
  assert.throws(() => validateEnvironment({ ...config, can_admins_bypass: true }));
  assert.throws(() => validateEnvironment({ ...config, protection_rules: [] }));
  assert.throws(() => validateEnvironment({ ...config, deployment_branch_policy: null }));
});
test('publish jobs use protected environments, OIDC and verified artifacts', () => {
  for (const [file, environment, tag] of [['publish.yml','npm','npm-v'],['publish-stage.yml','npm-stage','npm-stage-v']]) {
    const text = readFileSync(`.github/workflows/${file}`, 'utf8');
    assert.match(text, new RegExp(`tags: \\['${tag}\\*'\\]`));
    assert.match(text, new RegExp(`name: ${environment}\\n`));
    assert.match(text, /id-token: write/); assert.match(text, /npm run release:gate/);
    assert.match(text, /needs\.build\.outputs\.sha256/);
    assert.doesNotMatch(text, /NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./);
    assert.match(text, /github\.event_name == 'push'/);
  }
});
