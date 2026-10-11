import { test, afterEach } from 'rstack/test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { NextConfig } from 'next';
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
  // eslint-disable-next-line node/no-missing-import -- Published Next.js subpath; exercised by the real builds below.
} from 'next/constants.js';
import { extract } from 'tar';
import { withSkilli } from '@skilli/plugin-next';

const cleanup: string[] = [];
afterEach(async () => {
  for (const directory of cleanup.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

const exec = promisify(execFile);
const require = createRequire(import.meta.url);
const context = { defaultConfig: {} };
const filename = 'downloads/skill-installer.tgz';

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'skilli-next-'));
  cleanup.push(root);
  await mkdir(join(root, 'demo-agent'));
  await writeFile(
    join(root, 'demo-agent/SKILL.md'),
    '---\nname: demo-agent\ndescription: A demo skill.\n---\n# Demo\n',
  );
  await writeFile(
    join(root, 'cli.ts'),
    "const greeting: string = 'hello'; console.log(JSON.stringify({ greeting }));",
  );
  return await realpath(root);
}

function options(root: string): {
  root: string;
  skillDir: string;
  cli: { entry: string };
} {
  return { root, skillDir: 'demo-agent', cli: { entry: 'cli.ts' } };
}

test('configuration functions preserve phases, context, and user callbacks', async () => {
  const root = await fixture();
  const calls: string[] = [];
  const config: NextConfig = {
    basePath: '/app',
    webpack: (webpackConfig: unknown) => webpackConfig,
    headers: () => Promise.resolve([]),
  };
  const wrapped = withSkilli(options(root))(async (phase, received) => {
    calls.push(phase);
    assert.equal(received, context);
    return await Promise.resolve(config);
  });

  for (const phase of [PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER]) {
    assert.equal(await wrapped(phase, context), config);
    await assert.rejects(access(join(root, 'public', filename)));
  }
  assert.equal(await wrapped(PHASE_PRODUCTION_BUILD, context), config);
  assert.ok((await readFile(join(root, 'public', filename))).length > 0);
  assert.deepEqual(calls, [
    PHASE_DEVELOPMENT_SERVER,
    PHASE_PRODUCTION_SERVER,
    PHASE_PRODUCTION_BUILD,
  ]);
});

test('plain, promised, and synchronous configurations are accepted', async () => {
  const root = await fixture();
  const config: NextConfig = { output: 'export' };
  for (const input of [config, Promise.resolve(config), () => config]) {
    assert.equal(
      await withSkilli(options(root))(input)(PHASE_DEVELOPMENT_SERVER, context),
      config,
    );
  }
  assert.deepEqual(
    await withSkilli(options(root))()(PHASE_DEVELOPMENT_SERVER, context),
    {},
  );
});

test('the default root is the working directory when the wrapper is created', async () => {
  const root = await fixture();
  const plugin = pathToFileURL(resolve('dist/index.js')).href;
  await exec(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { withSkilli } from ${JSON.stringify(plugin)};
const wrapped = withSkilli({ skillDir: 'demo-agent', cli: { entry: 'cli.ts' } })({});
process.chdir(${JSON.stringify(tmpdir())});
await wrapped('phase-production-build', { defaultConfig: {} });`,
    ],
    { cwd: root },
  );
  assert.ok((await readFile(join(root, 'public', filename))).length > 0);
});

test('explicit roots and filenames determine public output and repeated loads refresh sources', async () => {
  const root = await fixture();
  const custom = 'installers/demo.tgz';
  const wrapped = withSkilli({ ...options(root), filename: custom })({});
  await wrapped(PHASE_PRODUCTION_BUILD, context);
  const archive = join(root, 'public', custom);
  const before = await readFile(archive);
  await writeFile(join(root, 'demo-agent/updated.md'), 'New source content');
  await wrapped(PHASE_PRODUCTION_BUILD, context);
  const after = await readFile(archive);
  assert.notDeepEqual(after, before);
  const extracted = join(root, 'extracted');
  await mkdir(extracted);
  await extract({ file: archive, cwd: extracted });
  assert.equal(
    await readFile(join(extracted, 'package/demo-agent/updated.md'), 'utf8'),
    'New source content',
  );
});

test('packaging and user configuration errors reject production configuration', async () => {
  const root = await fixture();
  const invalid = withSkilli({ ...options(root), filename: '../outside.tgz' })(
    {},
  );
  await assert.rejects(
    invalid(PHASE_PRODUCTION_BUILD, context),
    /safe relative/,
  );
  const badConfig = withSkilli(options(root))(() => {
    throw new Error('User config failed');
  });
  await assert.rejects(
    badConfig(PHASE_PRODUCTION_BUILD, context),
    /User config failed/,
  );
  await assert.rejects(access(join(root, 'public', filename)));
});

test.each(['turbopack', 'webpack'] as const)(
  'Next.js %s static export serves an archive containing a runnable CLI',
  async (bundler) => {
    const root = await fixture();
    const dependencies = await realpath(resolve('node_modules'));
    await symlink(dependencies, join(root, 'node_modules'), 'dir');
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        private: true,
        type: 'module',
        dependencies: { next: '*', react: '*', 'react-dom': '*' },
      }),
    );
    await mkdir(join(root, 'app'));
    await writeFile(
      join(root, 'app/layout.js'),
      'export default function Layout({ children }) { return <html><body>{children}</body></html>; }',
    );
    await writeFile(
      join(root, 'app/page.js'),
      `export default function Page() { return <a href="/app/${filename}">Install</a>; }`,
    );
    const plugin = pathToFileURL(resolve('dist/index.js')).href;
    // pnpm's package-local links resolve into the workspace's dependency store.
    // Keep those files in bounded additional roots instead of widening to `/`.
    const dependencyRoots: Record<string, { path: string }> = {
      links: { path: dependencies },
    };
    for (const dependency of ['next', 'react', 'react-dom']) {
      let directory = dirname(
        await realpath(require.resolve(`${dependency}/package.json`)),
      );
      let modules: string | undefined;
      while (directory !== dirname(directory)) {
        if (basename(directory) === 'node_modules') modules = directory;
        directory = dirname(directory);
      }
      assert.ok(modules, `Expected an installed ${dependency} dependency`);
      dependencyRoots[dependency] = { path: modules };
    }
    await writeFile(
      join(root, 'next.config.mjs'),
      `import { withSkilli } from ${JSON.stringify(plugin)};
export default withSkilli(${JSON.stringify(options(root))})(async () => ({
  output: 'export',
  basePath: '/app',
  assetPrefix: 'https://cdn.example.com',
  turbopack: { root: ${JSON.stringify(root)} },
  experimental: {
    cpus: 1,
    workerThreads: false,
    turbopackAdditionalRoots: ${JSON.stringify(dependencyRoots)},
  },
}));
`,
    );
    const args = [require.resolve('next/dist/bin/next'), 'build', root];
    if (bundler === 'webpack') args.push('--webpack');
    await exec(process.execPath, args, {
      cwd: root,
      timeout: 150000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    });

    const bytes = await readFile(join(root, 'out', filename));
    assert.deepEqual(bytes, await readFile(join(root, 'public', filename)));
    assert.match(
      await readFile(join(root, 'out/index.html'), 'utf8'),
      /href="\/app\/downloads\/skill-installer\.tgz"/,
    );
    const server = createServer((request, response) => {
      if (request.url !== `/app/${filename}`) {
        response.writeHead(404).end();
        return;
      }
      response
        .writeHead(200, { 'Content-Type': 'application/gzip' })
        .end(bytes);
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      const download = await fetch(
        `http://127.0.0.1:${String(address.port)}/app/${filename}`,
      );
      assert.equal(download.status, 200);
      const archive = join(root, 'downloaded.tgz');
      await writeFile(archive, Buffer.from(await download.arrayBuffer()));
      const extracted = join(root, 'extracted');
      await mkdir(extracted);
      await extract({ file: archive, cwd: extracted });
      const result = await exec(process.execPath, [
        join(extracted, 'package/demo-agent/scripts/cli.mjs'),
      ]);
      assert.deepEqual(JSON.parse(result.stdout), { greeting: 'hello' });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  },
);
