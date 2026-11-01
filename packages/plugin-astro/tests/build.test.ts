import { afterEach, test } from 'rstack/test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { dev, type AstroInlineConfig } from 'astro';
import { extract } from 'tar';
import { skilli } from '@skilli/plugin-astro';
import type { SkilliOptions } from 'skilli';

const cleanup: string[] = [];
const exec = promisify(execFile);
const filename = 'downloads/skill-installer.tgz';
const options = {
  skillDir: 'demo-agent',
  cli: { entry: 'cli/index.ts' },
};

afterEach(async () => {
  for (const dir of cleanup.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function fixture(archiveFilename = filename): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'skilli-astro-'));
  cleanup.push(root);
  await mkdir(join(root, 'src/pages/settings'), { recursive: true });
  await cp(
    resolve('../skilli/tests/fixtures/demo-agent'),
    join(root, 'demo-agent'),
    { recursive: true },
  );
  await cp(resolve('../skilli/tests/fixtures/cli'), join(root, 'cli'), {
    recursive: true,
  });
  await mkdir(join(root, 'node_modules'));
  for (const dependency of await readdir(resolve('node_modules'))) {
    if (!dependency.startsWith('.')) {
      await symlink(
        resolve('node_modules', dependency),
        join(root, 'node_modules', dependency),
        'dir',
      );
    }
  }
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await writeFile(
    join(root, 'tsconfig.json'),
    '{"extends":"astro/tsconfigs/strict"}',
  );
  const page = `---
const installerUrl = import.meta.env.BASE_URL.replace(/\\/?$/, '/') + ${JSON.stringify(archiveFilename)};
---
<a href={installerUrl}>Install the skill</a>`;
  await writeFile(join(root, 'src/pages/index.astro'), page);
  await writeFile(join(root, 'src/pages/settings/profile.astro'), page);
  return root;
}

async function buildFixture(
  config: Omit<AstroInlineConfig, 'integrations' | 'adapter'> & {
    root: string;
  },
  packaging: SkilliOptions = options,
  cwd = config.root,
): Promise<void> {
  // Astro falls back to cwd/.astro for static prerender intermediates when
  // outDir is outside cwd. Build in a subprocess with a temporary cwd.
  const runnerPath = join(config.root, 'build.mjs');
  const runner = `
    import assert from 'node:assert/strict';
    import { stat } from 'node:fs/promises';
    import { build } from 'astro';
    import node from '@astrojs/node';
    import { skilli } from ${JSON.stringify(pathToFileURL(resolve('dist/index.js')).href)};
    const config = ${JSON.stringify(config)};
    const options = ${JSON.stringify(packaging)};
    await build({
      ...config,
      configFile: false,
      logLevel: 'silent',
      adapter: config.output === 'server' ? node({ mode: 'standalone' }) : undefined,
      integrations: [
        {
          name: 'inspect-installer-before-adapter',
          hooks: {
            async 'astro:build:done'({ dir }) {
              assert.ok((await stat(new URL(options.filename ?? ${JSON.stringify(filename)}, dir))).size > 0);
            },
          },
        },
        skilli(options),
      ],
    });
  `;
  await writeFile(runnerPath, runner);
  await exec(process.execPath, [runnerPath], {
    cwd,
    timeout: 30000,
  });
}

async function checkArchive(archivePath: string, root: string): Promise<void> {
  assert.ok((await stat(archivePath)).size > 0);
  const extracted = join(root, 'extracted');
  await mkdir(extracted);
  await extract({ file: archivePath, cwd: extracted });
  const manifest = JSON.parse(
    await readFile(join(extracted, 'package/package.json'), 'utf8'),
  ) as {
    bin: Record<string, string>;
  };
  assert.equal(manifest.bin['demo-agent-install'], 'install.mjs');
  const output = await exec(process.execPath, [
    join(extracted, 'package/demo-agent/scripts/cli.mjs'),
  ]);
  assert.deepEqual(JSON.parse(output.stdout), { greeting: 'hello' });
}

test('static build without client JavaScript emits a runnable installer before build:done', async () => {
  const root = await fixture();
  const buildCwd = await mkdtemp(join(tmpdir(), 'skilli-astro-cwd-'));
  cleanup.push(buildCwd);
  await buildFixture({ root }, options, buildCwd);
  await checkArchive(join(root, 'dist', filename), root);
  assert.ok((await stat(join(root, 'dist/index.html'))).isFile());
});

test.each([
  { base: '/', assetsPrefix: undefined, expected: '/downloads/custom.tgz' },
  {
    base: '/app/',
    assetsPrefix: undefined,
    expected: '/app/downloads/custom.tgz',
  },
  {
    base: '/app/',
    assetsPrefix: 'https://cdn.example.com/assets',
    expected: '/app/downloads/custom.tgz',
  },
])(
  'static output and public installer URL respect base $base and CDN $assetsPrefix',
  async ({ base, assetsPrefix, expected }) => {
    const customFilename = 'downloads/custom.tgz';
    const root = await fixture(customFilename);
    await buildFixture(
      { root, base, outDir: './website', build: { assetsPrefix } },
      { ...options, filename: customFilename },
    );
    assert.match(
      await readFile(join(root, 'website/settings/profile/index.html'), 'utf8'),
      new RegExp(`href="${expected}"`),
    );
    await checkArchive(join(root, 'website', customFilename), root);
  },
);

test('Node SSR serves the installer from custom build.client with a base path', async () => {
  const root = await fixture();
  await buildFixture({
    root,
    output: 'server',
    base: '/app/',
    outDir: './website',
    build: { client: './public', server: './server' },
  });
  const archivePath = join(root, 'website/public', filename);
  await checkArchive(archivePath, root);
  await assert.rejects(stat(join(root, 'website/server', filename)), {
    code: 'ENOENT',
  });
  const runner = `
    import assert from 'node:assert/strict';
    import { once } from 'node:events';
    import { readFile } from 'node:fs/promises';
    const { startServer } = await import(${JSON.stringify(pathToFileURL(join(root, 'website/server/entry.mjs')).href)});
    const { server } = startServer();
    try {
      await once(server.server, 'listening');
      const origin = 'http://127.0.0.1:' + server.server.address().port;
      const response = await fetch(origin + '/app/${filename}');
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(${JSON.stringify(archivePath)}));
      const page = await fetch(origin + '/app/settings/profile/');
      assert.equal(page.status, 200);
      assert.match(await page.text(), /href="\\/app\\/downloads\\/skill-installer.tgz"/);
    } finally {
      await server.stop();
    }
  `;
  await exec(process.execPath, ['--input-type=module', '--eval', runner], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      ASTRO_NODE_AUTOSTART: 'disabled',
      ASTRO_NODE_LOGGING: 'disabled',
    },
    timeout: 30000,
  });
});

test('explicit packaging root overrides the Astro project root', async () => {
  const root = await fixture();
  const source = await fixture();
  await rm(join(root, 'demo-agent'), { recursive: true });
  await rm(join(root, 'cli'), { recursive: true });
  await buildFixture({ root }, { ...options, root: source });
  await checkArchive(join(root, 'dist', filename), root);
  assert.ok((await stat(join(root, 'dist/index.html'))).isFile());
});

test('development skips packaging even when the skill source is missing', async () => {
  const root = await fixture();
  const server = await dev({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0 },
    integrations: [skilli({ skillDir: 'missing-skill' })],
  });
  try {
    const response = await fetch(
      `http://127.0.0.1:${String(server.address.port)}/`,
    );
    assert.equal(response.status, 200);
    await assert.rejects(stat(join(root, 'dist', filename)), {
      code: 'ENOENT',
    });
    await assert.rejects(stat(join(root, 'public', filename)), {
      code: 'ENOENT',
    });
  } finally {
    await server.stop();
  }
});

test.each([
  { skillDir: 'missing-skill', filename, message: /ENOENT/ },
  {
    skillDir: options.skillDir,
    filename: '../escape.tgz',
    message: /safe relative/,
  },
])(
  'production propagates packaging failure for $skillDir and $filename',
  async ({ skillDir, filename: archiveFilename, message }) => {
    const root = await fixture();
    await assert.rejects(
      buildFixture(
        { root },
        { ...options, skillDir, filename: archiveFilename },
      ),
      message,
    );
  },
);
