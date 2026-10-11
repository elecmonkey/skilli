import { test, afterEach } from 'rstack/test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile,
  rm,
  stat,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { extract } from 'tar';

const cleanup: string[] = [];
afterEach(async () => {
  for (const directory of cleanup.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

const exec = promisify(execFile);
const moduleUrl = pathToFileURL(resolve('dist/index.js')).href;
const kitUrl = pathToFileURL(
  resolve('node_modules/@nuxt/kit/dist/index.mjs'),
).href;
const nuxtCli = resolve('node_modules/nuxt/bin/nuxt.mjs');
const defaultFilename = 'downloads/skill-installer.tgz';

async function temporary(): Promise<string> {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'skilli-nuxt-')),
  );
  cleanup.push(directory);
  return directory;
}

async function fixture(config = ''): Promise<string> {
  const root = await temporary();
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
  await mkdir(join(root, 'app'));
  await writeFile(
    join(root, 'app/app.vue'),
    '<template><p>Skilli fixture</p></template>',
  );
  await mkdir(join(root, 'skills'));
  await cp(
    resolve('../skilli/tests/fixtures/demo-agent'),
    join(root, 'skills/demo-agent'),
    { recursive: true },
  );
  await writeFile(
    join(root, 'cli.ts'),
    'const greeting: string = "hello"; console.log(JSON.stringify({ greeting }));',
  );
  await writeFile(
    join(root, 'nuxt.config.mjs'),
    `import skilli from ${JSON.stringify(moduleUrl)};
export default {
  modules: [skilli],
  devtools: { enabled: false },
  telemetry: false,
  skilli: { skillDir: './skills/demo-agent', cli: { entry: './cli.ts' } },
  ${config}
};`,
  );
  return root;
}

async function build(
  root: string,
  command: 'build' | 'generate' = 'build',
): Promise<void> {
  await exec(process.execPath, [nuxtCli, command, root], {
    cwd: root,
    env: { ...process.env, NUXT_TELEMETRY_DISABLED: '1', NO_COLOR: '1' },
    timeout: 100000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

async function checkArchive(
  root: string,
  filename = defaultFilename,
): Promise<Buffer> {
  const archive = join(root, '.output/public', filename);
  assert.ok((await stat(archive)).size > 0);
  const extracted = await temporary();
  await extract({ file: archive, cwd: extracted });
  const result = await exec(process.execPath, [
    join(extracted, 'package/demo-agent/scripts/cli.mjs'),
  ]);
  assert.deepEqual(JSON.parse(result.stdout), { greeting: 'hello' });
  assert.match(
    await readFile(join(extracted, 'package/install.mjs'), 'utf8'),
    /node/,
  );
  return readFile(archive);
}

test('Nuxt build deploys the archive and Nitro serves it under app.baseURL', async () => {
  const root = await fixture("app: { baseURL: '/app/' }");
  await build(root);
  const bytes = await checkArchive(root);
  const server = spawn(
    process.execPath,
    [join(root, '.output/server/index.mjs')],
    {
      cwd: root,
      env: { ...process.env, HOST: '127.0.0.1', PORT: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  try {
    const address = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Nitro startup timed out: ${output}`));
      }, 15000);
      server.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        const match = /http:\/\/127\.0\.0\.1:(\d+)/.exec(output);
        if (match) {
          clearTimeout(timeout);
          resolve(`http://127.0.0.1:${match[1]}`);
        }
      });
      server.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      server.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Nitro exited with ${String(code)}: ${output}`));
      });
      server.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    const response = await fetch(`${address}/app/${defaultFilename}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await once(server, 'exit');
    }
  }
});

test('Nuxt generate deploys a custom archive from an explicit root and buildDir', async () => {
  const inputs = await fixture();
  const root = await fixture(`
    buildDir: '.generated',
    skilli: {
      root: ${JSON.stringify(inputs)},
      skillDir: './skills/demo-agent',
      cli: { entry: './cli.ts' },
      filename: 'artifacts/demo.tgz',
    },
  `);
  await rm(join(root, 'skills'), { recursive: true });
  await rm(join(root, 'cli.ts'));
  await build(root, 'generate');
  await checkArchive(root, 'artifacts/demo.tgz');
  assert.match(
    await readFile(join(root, '.output/public/index.html'), 'utf8'),
    /Skilli fixture/,
  );
  assert.ok(
    (await stat(join(root, '.generated/skilli/public/artifacts/demo.tgz')))
      .size > 0,
  );
});

test('development registers no packaging hook and ignores missing inputs', async () => {
  const root = await fixture("skilli: { skillDir: './missing' }");
  await exec(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { loadNuxt } from ${JSON.stringify(kitUrl)};
    const nuxt = await loadNuxt({ cwd: ${JSON.stringify(root)}, dev: true });
    try { await nuxt.callHook('nitro:build:before', nuxt._nitro); }
    finally { await nuxt.close(); }
  `,
    ],
    { cwd: root, timeout: 30000 },
  );
  await assert.rejects(stat(join(root, '.nuxt/skilli')), /ENOENT/);
  await assert.rejects(stat(join(root, '.output')), /ENOENT/);
});

test('production packaging errors fail the Nuxt build', async () => {
  const root = await fixture(
    "skilli: { skillDir: './skills/demo-agent', filename: '../escape.tgz' }",
  );
  await assert.rejects(build(root), /safe relative path/);
  await assert.rejects(
    stat(join(root, '.output/public', defaultFilename)),
    /ENOENT/,
  );
});

test('production requires skillDir and Nitro public assets', async () => {
  const root = await fixture('skilli: {}');
  await writeFile(
    join(root, 'nuxt.config.mjs'),
    `
    import skilli from ${JSON.stringify(moduleUrl)};
    export default { modules: [skilli], devtools: { enabled: false }, telemetry: false };
  `,
  );
  await assert.rejects(build(root), /requires a skillDir option/);
  const noPublic = await fixture('nitro: { noPublicDir: true }');
  await assert.rejects(build(noPublic), /requires Nitro public assets/);
});
