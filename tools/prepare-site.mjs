/** Prepare an isolated Sites source checkout without UE files, local data or secrets. */
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(root, '.sites-checkout', 'batyskaf-public');
if (relative(root, destination).startsWith('..')) throw new Error('Invalid Site checkout');
const manifest = JSON.parse(readFileSync(join(root, '.openai', 'hosting.json'), 'utf8'));
if (!manifest.project_id) throw new Error('Register the Site before preparing its source');
mkdirSync(destination, { recursive: true });
for (const name of [
  'src',
  'public',
  'server',
  'tests',
  'tools',
  'docs',
  '.openai/hosting.json',
  'package.json',
  'package-lock.json',
  'index.html',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  '.gitignore',
  '.prettierrc.json',
  '.prettierignore',
  '.env.example',
  'README.md',
]) {
  cpSync(join(root, name), join(destination, name), { recursive: true });
}
console.log(JSON.stringify({ project_id: manifest.project_id, checkout_path: destination }));
