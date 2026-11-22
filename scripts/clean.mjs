// Removes build output. Cross-platform replacement for `rm -rf dist`.
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

for (const dir of ['dist']) {
  rmSync(fileURLToPath(new URL(`../${dir}`, import.meta.url)), {
    recursive: true,
    force: true,
  });
}
