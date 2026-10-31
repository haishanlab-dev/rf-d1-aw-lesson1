// P0 packages the existing pages verbatim; it never regenerates lessons or audio.
import { cpSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
// Explicit public paths keep tools, configs, credentials and cf-progress out.
const paths = [
  'index.html', 'robots.txt',
  '21st', 'assets', 'book', 'content', 'progress', 'review',
  'science-review', 'unit1-v2', 'unit2', 'unit3', 'unit4', 'voice',
];
// Fail before replacing the output if a required source path is missing.
for (const path of paths) statSync(join(root, path));
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
for (const path of paths) {
  cpSync(join(root, path), join(output, path), { recursive: true });
}
console.log(`Copied ${paths.length} public paths to dist/ without changing bytes.`);
