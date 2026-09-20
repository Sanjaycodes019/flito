// Lints the given files with the ESLint install and config of one project.
// ESLint resolves both from the working directory, so this runs it from
// inside the project folder. Usage: node scripts/lint-project.js <project> <files...>
const path = require('path');
const { spawnSync } = require('child_process');

const [project, ...files] = process.argv.slice(2);
const cwd = path.join(__dirname, '..', project);
const relative = files.map((file) => path.relative(cwd, path.resolve(file)));

const bin = path.join(cwd, 'node_modules', 'eslint', 'bin', 'eslint.js');
const result = spawnSync(process.execPath, [bin, '--fix', '--no-warn-ignored', ...relative], { cwd, stdio: 'inherit' });
process.exit(result.status ?? 1);
