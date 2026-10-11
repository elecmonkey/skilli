import { afterEach, test } from 'rstack/test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import webpack, {
  type Compiler,
  type Configuration,
  type MultiCompiler,
  type MultiStats,
  type Stats,
} from 'webpack';
import { extract } from 'tar';
import { SkilliPlugin } from '@skilli/plugin-webpack';

const cleanup: string[] = [];
const exec = promisify(execFile);
const defaultFilename = 'downloads/skill-installer.tgz';
const options = {
  skillDir: './skills/demo-agent',
  cli: { entry: './cli/index.ts' },
};

afterEach(async () => {
  for (const root of cleanup.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'skilli-webpack-test-'));
  cleanup.push(root);
  await cp(
    resolve(import.meta.dirname, '../../skilli/tests/fixtures/demo-agent'),
    join(root, 'skills/demo-agent'),
    { recursive: true },
  );
  await cp(
    resolve(import.meta.dirname, '../../skilli/tests/fixtures/cli'),
    join(root, 'cli'),
    { recursive: true },
  );
  await writeFile(join(root, 'main.js'), 'globalThis.ready = true;');
  return root;
}

function config(root: string): Configuration {
  return {
    context: root,
    mode: 'production',
    entry: './main.js',
    output: { path: join(root, 'output'), filename: 'main.js' },
    optimization: { minimize: false },
    plugins: [new SkilliPlugin(options)],
  };
}

function run(compiler: Compiler | MultiCompiler): Promise<Stats | MultiStats> {
  return new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close((closeError) => {
        if (error) {
          reject(error);
        } else if (closeError) {
          reject(closeError);
        } else if (!stats || stats.hasErrors()) {
          reject(new Error(stats?.toString({ all: false, errors: true })));
        } else {
          resolve(stats);
        }
      });
    });
  });
}

async function build(configuration: Configuration): Promise<Stats> {
  const compiler = webpack(configuration);
  assert.ok(compiler);
  const stats = await run(compiler);
  assert.ok('compilation' in stats);
  return stats;
}

test('emits a default installer with resources and a runnable bundled CLI', async () => {
  const root = await fixture();
  const stats = await build(config(root));
  assert.ok(stats.compilation.getAsset(defaultFilename));
  const archivePath = join(root, 'output', defaultFilename);
  assert.ok((await stat(archivePath)).size > 0);
  const extracted = join(root, 'extracted');
  await mkdir(extracted);
  await extract({ file: archivePath, cwd: extracted });
  assert.equal(
    await readFile(
      join(extracted, 'package/demo-agent/references/commands.md'),
      'utf8',
    ),
    await readFile(
      join(root, 'skills/demo-agent/references/commands.md'),
      'utf8',
    ),
  );
  const cli = await exec(process.execPath, [
    join(extracted, 'package/demo-agent/scripts/cli.mjs'),
  ]);
  assert.deepEqual(JSON.parse(cli.stdout), { greeting: 'hello' });
  const installer = await exec(process.execPath, [
    join(extracted, 'package/install.mjs'),
    '--help',
  ]);
  assert.match(installer.stdout, /Install the bundled skill/);
});

test('respects custom root, filename, and Webpack output directory', async () => {
  const root = await fixture();
  const website = join(root, 'website');
  await mkdir(website);
  await writeFile(join(website, 'main.js'), 'globalThis.ready = true;');
  const filename = 'archives/custom.tgz';
  const stats = await build({
    ...config(website),
    output: { path: join(root, 'public'), filename: 'bundle.js' },
    plugins: [new SkilliPlugin({ ...options, root, filename })],
  });
  assert.ok(stats.compilation.getAsset(filename));
  assert.ok((await stat(join(root, 'public', filename))).size > 0);
  assert.equal(fs.existsSync(join(website, 'dist', filename)), false);
});

test.each([
  {
    publicPath: '/',
    expected: 'https://example.com/downloads/skill-installer.tgz',
  },
  {
    publicPath: '/app/',
    expected: 'https://example.com/app/downloads/skill-installer.tgz',
  },
  {
    publicPath: 'https://cdn.example.com/app/',
    expected: 'https://cdn.example.com/app/downloads/skill-installer.tgz',
  },
])(
  'installer URL respects publicPath $publicPath on nested routes',
  async ({ publicPath, expected }) => {
    const root = await fixture();
    await writeFile(
      join(root, 'main.js'),
      `globalThis.installerUrl = new URL(
        __webpack_public_path__ + ${JSON.stringify(defaultFilename)},
        window.location.origin,
      ).href;`,
    );
    const stats = await build({
      ...config(root),
      output: { ...config(root).output, publicPath },
    });
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
    runInNewContext(
      await readFile(join(root, 'output/main.js'), 'utf8'),
      browser,
    );
    assert.equal(browser.installerUrl, expected);
    assert.ok(stats.compilation.getAsset(defaultFilename));
    assert.ok((await stat(join(root, 'output', defaultFilename))).size > 0);
  },
);

test('uses Webpack outputFileSystem for the archive', async () => {
  const root = await fixture();
  const compiler = webpack(config(root));
  assert.ok(compiler);
  let archive: Buffer | undefined;
  compiler.outputFileSystem = new Proxy(fs, {
    get(target, property: keyof typeof fs) {
      if (property === 'writeFile') {
        return (path: string, data: Buffer, callback: fs.NoParamCallback) => {
          if (path === join(root, 'output', defaultFilename)) {
            archive = data;
            callback(null);
          } else {
            fs.writeFile(path, data, callback);
          }
        };
      }
      return target[property];
    },
  });
  await run(compiler);
  assert.ok(archive && archive.length > 0);
  assert.equal(fs.existsSync(join(root, 'output', defaultFilename)), false);
});

test.each(['development', 'none'] as const)(
  'skips packaging in %s mode',
  async (mode) => {
    const root = await fixture();
    const stats = await build({
      ...config(root),
      mode,
      plugins: [new SkilliPlugin({ skillDir: './missing' })],
    });
    assert.equal(stats.compilation.getAsset(defaultFilename), undefined);
    assert.equal(fs.existsSync(join(root, 'output', defaultFilename)), false);
  },
);

test('packages when Webpack defaults to production mode', async () => {
  const root = await fixture();
  const stats = await build({ ...config(root), mode: undefined });
  assert.ok(stats.compilation.getAsset(defaultFilename));
});

test('fails the build on packaging errors', async () => {
  const root = await fixture();
  await writeFile(
    join(root, 'skills/demo-agent/SKILL.md'),
    '# Missing metadata',
  );
  await assert.rejects(build(config(root)), /SKILL\.md needs YAML frontmatter/);
  assert.equal(fs.existsSync(join(root, 'output', defaultFilename)), false);
});

test('fails the build when another asset has the archive filename', async () => {
  const root = await fixture();
  await assert.rejects(
    build({
      ...config(root),
      plugins: [
        new SkilliPlugin(options),
        {
          apply(compiler) {
            compiler.hooks.thisCompilation.tap('collision', (compilation) => {
              compilation.hooks.processAssets.tap(
                { name: 'collision', stage: -3000 },
                () => {
                  compilation.emitAsset(
                    defaultFilename,
                    new compiler.webpack.sources.RawSource('existing'),
                  );
                },
              );
            });
          },
        },
      ],
    }),
    /Asset already exists: downloads\/skill-installer\.tgz/,
  );
});

test('fails duplicate plugin instances instead of replacing the archive', async () => {
  const root = await fixture();
  await assert.rejects(
    build({
      ...config(root),
      plugins: [new SkilliPlugin(options), new SkilliPlugin(options)],
    }),
    /Asset already exists/,
  );
});

test('only the selected client compiler emits an archive', async () => {
  const root = await fixture();
  const compiler = webpack([
    { ...config(root), name: 'client' },
    {
      ...config(root),
      name: 'server',
      target: 'node',
      output: { path: join(root, 'server'), filename: 'main.js' },
      plugins: [],
    },
  ]);
  assert.ok(compiler);
  const stats = await run(compiler);
  assert.ok('stats' in stats);
  assert.ok(stats.stats[0].compilation.getAsset(defaultFilename));
  assert.equal(stats.stats[1].compilation.getAsset(defaultFilename), undefined);
  assert.equal(fs.existsSync(join(root, 'server', defaultFilename)), false);
});

test('skips child compilers even when the plugin is explicitly applied', async () => {
  const root = await fixture();
  const stats = await build({
    ...config(root),
    plugins: [
      new SkilliPlugin(options),
      {
        apply(compiler) {
          compiler.hooks.thisCompilation.tap('child', (compilation) => {
            compilation.hooks.processAssets.tapPromise(
              { name: 'child', stage: -3000 },
              () => {
                const child = compilation.createChildCompiler(
                  'child',
                  { filename: 'child.js' },
                  [
                    new compiler.webpack.EntryPlugin(root, './main.js', {
                      name: 'child',
                    }),
                    new SkilliPlugin({ skillDir: './missing' }),
                  ],
                );
                return new Promise<void>((resolve, reject) => {
                  child.runAsChild((error, _entries, childCompilation) => {
                    if (error) {
                      reject(error);
                    } else if (childCompilation?.errors.length) {
                      reject(childCompilation.errors[0]);
                    } else {
                      assert.equal(
                        childCompilation?.getAsset(defaultFilename),
                        undefined,
                      );
                      resolve();
                    }
                  });
                });
              },
            );
          });
        },
      },
    ],
  });
  assert.ok(stats.compilation.getAsset('child.js'));
  assert.ok(stats.compilation.getAsset(defaultFilename));
});
