import { test, afterEach } from 'rstack/test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRsbuild } from 'rstack/app';
import { pluginSkilli } from '@skilli/plugin-rsbuild';

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

test('Rsbuild produces installer in custom website output', async () => {
  const root = await fixture();
  const rsbuild = await createRsbuild({
    cwd: root,
    rsbuildConfig: {
      plugins: [pluginSkilli(options)],
      source: { entry: { index: join(root, 'main.js') } },
      output: { distPath: { root: 'website' } },
    },
  });
  await rsbuild.build();
  assert.ok((await stat(join(root, 'website', options.filename))).size > 0);
});
