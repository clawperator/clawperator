import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--unit')) throw new Error('Usage: test.mjs [--unit]');
function discover(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? discover(path) : path.endsWith('.test.js') ? [path] : [];
  });
}
const roots = args.includes('--unit') ? ['dist/test/unit', 'dist/cli'] : ['dist'];
const files = roots.flatMap(discover).sort();
if (!files.length) throw new Error('No built tests found. Run npm run build first.');
console.log(`Running ${files.length} Node test files`);
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
