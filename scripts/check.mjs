import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const dir of ['src', 'scripts', 'sandbox', 'tests']) {
  for (const name of await readdir(dir)) {
    if (!/\.m?js$/.test(name)) continue;
    const result = spawnSync(process.execPath, ['--check', `${dir}/${name}`], {
      stdio: 'inherit',
    });
    if (result.status !== 0) process.exit(1);
    const text = await readFile(`${dir}/${name}`, 'utf8');
    if (/\s+$/m.test(text.split('\n').filter(Boolean).join('\n')))
      throw new Error('Trailing whitespace: ' + name);
  }
}
const kwinEntry = await readFile('scripts/kwin-entry.js', 'utf8');
if (/\.deleteLater\s*\(/.test(kwinEntry))
  throw new Error('KWin ScriptTimer does not expose deleteLater()');
JSON.parse(await readFile('package/metadata.json', 'utf8'));
console.log('JavaScript syntax and metadata OK');
