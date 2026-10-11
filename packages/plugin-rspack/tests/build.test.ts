import { afterEach, test } from 'rstack/test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
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
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import {
  rspack,
  type Compiler,
  type Configuration,
  type OutputFileSystem,
  type Stats,
} from '@rspack/core';
import { extract } from 'tar';
import { SkilliPlugin } from '@skilli/plugin-rspack';

const cleanup: string[] = [];
const runFile = promisify(execFile);
const filename = 'downloads/skill-installer.tgz';
const options = {
  skillDir: 'demo-agent',
  cli: { entry: 'cli/index.ts' },
};

afterEach(async () => {
  for (const directory of cleanup.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'skilli-rspack-test-'));
  cleanup.push(root);
  await cp(
    resolve('../skilli/tests/fixtures/demo-agent'),
    join(root, 'demo-agent'),
    {
      recursive: true,
    },
  );
  await cp(resolve('../skilli/tests/fixtures/cli'), join(root, 'cli'), {
    recursive: true,
  });
  await writeFile(join(root, 'main.js'), 'globalThis.built = true;');
  return root;
}

function config(root: string): Configuration {
  return {
    mode: 'production',
    context: root,
    entry: './main.js',
    output: { path: join(root, 'website'), filename: 'main.js' },
    plugins: [new SkilliPlugin(options)],
  };
}

async function build(compiler: Compiler): Promise<Stats> {
  try {
    const stats = await new Promise<Stats>((resolve, reject) => {
      compiler.run((error, result) => {
        if (error) {
          reject(error);
        } else if (!result || result.hasErrors()) {
          reject(
            new Error(
              result?.toString({ all: false, errors: true }) ??
                'No build stats.',
            ),
          );
        } else {
          resolve(result);
        }
      });
    });
    return stats;
  } finally {
    await new Promise<void>((resolve, reject) => {
      compiler.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

async function inspectArchive(archive: string, root: string): Promise<void> {
  const unpacked = join(root, 'unpacked');
  await mkdir(unpacked);
  await extract({ file: archive, cwd: unpacked });
  const packageRoot = join(unpacked, 'package');
  assert.match(
    await readFile(join(packageRoot, 'demo-agent/SKILL.md'), 'utf8'),
    /name: demo-agent/,
  );
  assert.ok((await stat(join(packageRoot, 'install.mjs'))).size > 0);
  const metadata: unknown = JSON.parse(
    await readFile(join(packageRoot, 'package.json'), 'utf8'),
  );
  assert.deepEqual((metadata as { skilli: unknown }).skilli, {
    skillName: 'demo-agent',
  });
  const { stdout } = await runFile(process.execPath, [
    join(packageRoot, 'demo-agent/scripts/cli.mjs'),
  ]);
  assert.deepEqual(JSON.parse(stdout), { greeting: 'hello' });
}

test('production build emits an installer asset in the configured output with a runnable CLI', async () => {
  const root = await fixture();
  const stats = await build(rspack(config(root)));
  assert.ok(stats.compilation.getAsset(filename));
  await inspectArchive(join(root, 'website', filename), root);
});

test('uses Rspack production mode by default when mode is omitted', async () => {
  const root = await fixture();
  const stats = await build(rspack({ ...config(root), mode: undefined }));
  assert.ok(stats.compilation.getAsset(filename));
});

test('custom filename and root override resolve the skill and CLI independently of compiler context', async () => {
  const root = await fixture();
  const source = await fixture();
  const customFilename = 'assets/custom-installer.tgz';
  await build(
    rspack({
      ...config(root),
      plugins: [
        new SkilliPlugin({
          ...options,
          root: source,
          filename: customFilename,
        }),
      ],
    }),
  );
  assert.ok((await stat(join(root, 'website', customFilename))).size > 0);
  await inspectArchive(join(root, 'website', customFilename), root);
});

test('emits through an in-memory output filesystem without writing the website to disk', async () => {
  const root = await fixture();
  const files = new Map<string, Buffer>();
  const missing = Object.assign(new Error('Missing in-memory file.'), {
    code: 'ENOENT',
  });
  const outputFileSystem: OutputFileSystem = {
    ...fs,
    mkdir(_path, callback) {
      callback(null);
    },
    writeFile(path, contents, callback) {
      files.set(String(path), Buffer.from(contents));
      callback(null);
    },
    readFile(path, callback) {
      const contents = files.get(path);
      callback(contents ? null : missing, contents);
    },
    stat(_path, callback) {
      callback(missing);
    },
  };
  const compiler = rspack(config(root));
  compiler.outputFileSystem = outputFileSystem;
  await build(compiler);
  const archive = files.get(join(root, 'website', filename));
  assert.ok(archive && archive.length > 0);
  await assert.rejects(stat(join(root, 'website')), { code: 'ENOENT' });
  const archivePath = join(root, 'memory-installer.tgz');
  await writeFile(archivePath, archive);
  await inspectArchive(archivePath, root);
});

test.each(['development', 'none'] as const)(
  'skips packaging in %s mode',
  async (mode) => {
    const root = await fixture();
    const stats = await build(
      rspack({
        ...config(root),
        mode,
        plugins: [new SkilliPlugin({ skillDir: 'missing' })],
      }),
    );
    assert.equal(stats.compilation.getAsset(filename), undefined);
  },
);

test('reports packaging errors as failed builds', async () => {
  const root = await fixture();
  await writeFile(join(root, 'demo-agent/SKILL.md'), 'Missing frontmatter.');
  await assert.rejects(
    build(rspack(config(root))),
    /SKILL.md needs YAML frontmatter/,
  );
});

test('rejects an unsafe output filename', async () => {
  const root = await fixture();
  await assert.rejects(
    build(
      rspack({
        ...config(root),
        plugins: [new SkilliPlugin({ ...options, filename: '../outside.tgz' })],
      }),
    ),
    /Expected a safe relative path/,
  );
  await assert.rejects(stat(join(root, 'outside.tgz')), { code: 'ENOENT' });
});

test('rejects collisions with another compilation asset', async () => {
  const root = await fixture();
  await assert.rejects(
    build(
      rspack({
        ...config(root),
        plugins: [
          {
            apply(compiler: Compiler) {
              compiler.hooks.thisCompilation.tap(
                'existing-installer',
                (compilation) => {
                  compilation.hooks.processAssets.tap(
                    {
                      name: 'existing-installer',
                      stage:
                        compiler.webpack.Compilation
                          .PROCESS_ASSETS_STAGE_ADDITIONAL - 1,
                    },
                    () => {
                      compilation.emitAsset(
                        filename,
                        new compiler.webpack.sources.RawSource('existing'),
                      );
                    },
                  );
                },
              );
            },
          },
          new SkilliPlugin(options),
        ],
      }),
    ),
    /Asset already exists/,
  );
});

test('rejects duplicate plugin instances targeting the same filename', async () => {
  const root = await fixture();
  await assert.rejects(
    build(
      rspack({
        ...config(root),
        plugins: [new SkilliPlugin(options), new SkilliPlugin(options)],
      }),
    ),
    /Asset already exists/,
  );
});

test('skips child compilers while packaging the parent compilation', async () => {
  const root = await fixture();
  const stats = await build(
    rspack({
      ...config(root),
      plugins: [
        new SkilliPlugin(options),
        {
          apply(compiler: Compiler) {
            compiler.hooks.make.tapAsync(
              'child-build',
              (compilation, callback) => {
                const child = compilation.createChildCompiler(
                  'child',
                  { filename: 'child.js' },
                  [
                    new compiler.webpack.EntryPlugin(root, './main.js', {
                      name: 'child',
                    }),
                    new SkilliPlugin({ skillDir: 'missing' }),
                  ],
                );
                child.runAsChild((error) => {
                  callback(error);
                });
              },
            );
          },
        },
      ],
    }),
  );
  assert.ok(stats.compilation.getAsset(filename));
  assert.ok(stats.compilation.getAsset('child.js'));
});

test('a plugin instance can be used in multiple independent production compilers', async () => {
  const root = await fixture();
  const other = await fixture();
  const plugin = new SkilliPlugin(options);
  const compilers = [root, other].map((context) =>
    rspack({
      ...config(context),
      plugins: [plugin],
    }),
  );
  await Promise.all(compilers.map(build));
  for (const context of [root, other]) {
    assert.ok((await stat(join(context, 'website', filename))).size > 0);
  }
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
  'download URL respects publicPath $publicPath on nested routes',
  async ({ publicPath, expected }) => {
    const root = await fixture();
    await writeFile(
      join(root, 'main.js'),
      `globalThis.installerUrl = new URL(__webpack_public_path__ + ${JSON.stringify(filename)}, window.location.origin).href;`,
    );
    await build(
      rspack({
        ...config(root),
        output: { ...config(root).output, publicPath },
      }),
    );
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
      await readFile(join(root, 'website/main.js'), 'utf8'),
      browser,
    );
    assert.equal(browser.installerUrl, expected);
  },
);
