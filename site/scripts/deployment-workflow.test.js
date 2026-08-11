import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const deployWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'deploy-site.yml');
const legacyRefreshWorkflowPath = path.join(
  repoRoot,
  '.github',
  'workflows',
  'update-draft-hips.yml',
);
const deployWorkflow = fs.readFileSync(deployWorkflowPath, 'utf8');

function workflowStep(name) {
  const marker = `      - name: ${name}\n`;
  const start = deployWorkflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing workflow step: ${name}`);
  const next = deployWorkflow.indexOf('\n      - name:', start + marker.length);
  return deployWorkflow.slice(start, next === -1 ? undefined : next);
}

test('the GitHub Pages workflow owns the scheduled draft-HIP refresh', () => {
  assert.match(deployWorkflow, /schedule:\s*\n\s+- cron: "0 \*\/6 \* \* \*"/);
  assert.equal(
    fs.existsSync(legacyRefreshWorkflowPath),
    false,
    'The obsolete Netlify refresh workflow must not be restored',
  );
  assert.doesNotMatch(deployWorkflow, /NETLIFY_BUILD_HOOK/);
});

test('the production workflow generates data once with live drafts required', () => {
  const dataStep = workflowStep('Build data');
  const siteStep = workflowStep('Build site');

  assert.match(dataStep, /run: npm run build:data\s/);
  assert.match(dataStep, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(dataStep, /REQUIRE_LIVE_DRAFT_HIPS: "true"/);
  assert.match(siteStep, /run: npm run build:app\s/);
  assert.doesNotMatch(siteStep, /GITHUB_TOKEN/);
  assert.equal((deployWorkflow.match(/run: npm run build:data\s/g) || []).length, 1);
});
