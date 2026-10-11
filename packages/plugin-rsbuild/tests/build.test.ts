import { test, afterEach } from 'rstack/test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  writeFile,
  rm,
  stat,
  readFile,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
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
  await writeFile(
    join(root, 'main.js'),
    `globalThis.installerUrl = new URL(
      import.meta.env.ASSET_PREFIX + '/' + ${JSON.stringify(options.filename)},
      window.location.origin,
    ).href;`,
  );
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

test.each([
  {
    base: '/',
    assetPrefix: '/',
    expected: 'https://example.com/downloads/demo-installer.tgz',
  },
  {
    base: '/app/',
    assetPrefix: '/app/',
    expected: 'https://example.com/app/downloads/demo-installer.tgz',
  },
  {
    base: '/app/',
    assetPrefix: 'https://cdn.example.com/app/',
    expected: 'https://cdn.example.com/app/downloads/demo-installer.tgz',
  },
])(
  'Rsbuild installer URL respects asset prefix $assetPrefix on nested routes',
  async ({ base, assetPrefix, expected }) => {
    const root = await fixture();
    const rsbuild = await createRsbuild({
      cwd: root,
      rsbuildConfig: {
        plugins: [pluginSkilli(options)],
        server: { base },
        source: { entry: { index: join(root, 'main.js') } },
        output: { assetPrefix, distPath: { root: 'website' } },
      },
    });
    await rsbuild.build();
    const jsDir = join(root, 'website/static/js');
    const entry = (await readdir(jsDir)).find((file) => file.endsWith('.js'));
    assert.ok(entry);
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
    runInNewContext(await readFile(join(jsDir, entry), 'utf8'), browser);
    assert.equal(browser.installerUrl, expected);
    assert.ok((await stat(join(root, 'website', options.filename))).size > 0);
  },
);
