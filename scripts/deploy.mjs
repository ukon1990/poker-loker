#!/usr/bin/env node
/*
 Local deploy to the VPS cluster. Only runs from `main`.
 Runs every check first, unless --skip-verify, --check or --secrets-only is given.
*/

import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const deployScript = join(repoRoot, 'scripts/deploy/deploy-vps-local.sh');
const VERIFY_STEPS = ['lint', 'typecheck', 'test', 'test:e2e'];

function run(command, args) {
  const { status } = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (status !== 0) process.exit(status ?? 1);
}

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const checkOnly = args.includes('--check');
const skipVerify = args.includes('--skip-verify');
const secretsOnly = args.includes('--secrets-only');

const { stdout } = spawnSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' });
const branch = stdout.trim();
if (branch !== 'main') {
  console.error(`Deploy is only allowed from main. Current branch: ${branch || 'detached HEAD'}.`);
  process.exit(1);
}

if (checkOnly) {
  run('bash', [deployScript, '--preflight']);
  process.exit(0);
}

if (!skipVerify && !secretsOnly) {
  for (const step of VERIFY_STEPS) run('pnpm', ['--dir', 'frontend', step]);
}

run('bash', [deployScript, ...(secretsOnly ? ['--secrets-only'] : [])]);
