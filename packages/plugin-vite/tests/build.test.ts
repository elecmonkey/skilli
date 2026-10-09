import { test, afterEach } from 'rstack/test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { skilli } from '@skilli/plugin-vite';

const cleanup: string[] = [];
afterEach(async () => {
  for (const dir of cleanup.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});
const options = {
  skillDir: resolve('../skilli/tests/fixtures/demo-agent'),
  cli: { entry: resolve('../skilli/tests/fixtures/cli/index.ts') },
  filename: 'downloads/demo-installer.tgz',
};
async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'skilli-web-'));
  cleanup.push(root);
  await writeFile(
    join(root, 'index.html'),
    '<div>Demo</div><script type="module" src="/main.js"></script>',
  );
  await writeFile(join(root, 'main.js'), 'console.log("demo");');
  return root;
}

test('Vite emits installer as a build asset', async () => {
  const root = await fixture();
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [skilli(options)],
  });
  assert.ok(!Array.isArray(result) && 'output' in result);
  assert.ok(result.output.some((x) => x.fileName === options.filename));
  assert.ok((await stat(join(root, 'dist', options.filename))).size > 0);
});
