import { test, afterEach } from 'rstack/test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
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
  await writeFile(
    join(root, 'main.js'),
    `globalThis.installerUrl = new URL(
      import.meta.env.BASE_URL + ${JSON.stringify(options.filename)},
      window.location.origin,
    ).href;`,
  );
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

test.each([
  { base: '/', expected: 'https://example.com/downloads/demo-installer.tgz' },
  {
    base: '/app/',
    expected: 'https://example.com/app/downloads/demo-installer.tgz',
  },
  {
    base: 'https://cdn.example.com/app/',
    expected: 'https://cdn.example.com/app/downloads/demo-installer.tgz',
  },
])(
  'Vite installer URL respects base $base on nested routes',
  async ({ base, expected }) => {
    const root = await fixture();
    const result = await build({
      root,
      base,
      configFile: false,
      logLevel: 'silent',
      plugins: [skilli(options)],
      build: { modulePreload: false },
    });
    assert.ok(!Array.isArray(result) && 'output' in result);
    const entry = result.output.find(
      (asset) => asset.type === 'chunk' && asset.isEntry,
    );
    assert.ok(entry && entry.type === 'chunk');
    const browser = {
      URL,
      window: {
        location: {
          origin: 'https://example.com',
          href: 'https://example.com/app/settings/profile/',
        },
      },
      installerUrl: '',
    };
    runInNewContext(entry.code, browser);
    assert.equal(browser.installerUrl, expected);
    assert.ok((await stat(join(root, 'dist', options.filename))).size > 0);
    assert.ok(
      result.output.some((asset) => asset.fileName === options.filename),
    );
  },
);
