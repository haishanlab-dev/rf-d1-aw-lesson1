// Run both existing suites even when one fails; preserve a failing exit status.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
for (const args of [
  ['--test', 'cf-progress/worker.test.mjs'],
  ['tools/progress-api.test.js', 'assets/progress-api.js'],
]) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exitCode = 1;
}
