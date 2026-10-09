import { createServer } from 'node:http';
import { test, afterEach } from 'rstack/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extract } from 'tar';
import { packSkill } from 'skilli';

const cleanup: string[] = [];
afterEach(async () => {
  for (const dir of cleanup.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

const exec = promisify(execFile);
const fixture = resolve('../skilli/tests/fixtures/demo-agent');
const entry = resolve('../skilli/tests/fixtures/cli/index.ts');
async function temporary(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'skilli-test-'));
  cleanup.push(dir);
  return dir;
}

test('archive runs via npx, bundles CLI and installs both targets; updates need consent', async () => {
  const dir = await temporary();
  const result = await packSkill({
    skillDir: fixture,
    cli: { entry },
    outDir: dir,
  });
  const extracted = join(dir, 'extracted');
  await mkdir(extracted);
  await extract({ file: result.archivePath, cwd: extracted });
  const manifest = JSON.parse(
    await readFile(join(extracted, 'package/package.json'), 'utf8'),
  ) as {
    bin: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  assert.equal(manifest.bin['demo-agent-install'], 'install.mjs');
  assert.equal(manifest.dependencies, undefined);
  const output = await exec(process.execPath, [
    join(extracted, 'package/demo-agent/scripts/cli.mjs'),
  ]);
  assert.deepEqual(JSON.parse(output.stdout), { greeting: 'hello' });
  const home = join(dir, 'home');
  await mkdir(home);
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    npm_config_cache: join(dir, 'npm-cache'),
  };
  const archive = await readFile(result.archivePath);
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    response.end(archive);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${String(address.port)}/demo-agent-installer.tgz`;
    await exec(
      'npx',
      ['--yes', url, '--target', 'all', '--site', 'https://example.com'],
      { env, timeout: 45000 },
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
  for (const target of ['.agents', '.claude']) {
    assert.match(
      await readFile(join(home, target, 'skills/demo-agent/SKILL.md'), 'utf8'),
      /demo-agent/,
    );
    assert.deepEqual(
      JSON.parse(
        await readFile(
          join(home, target, 'skills/demo-agent/site.json'),
          'utf8',
        ),
      ),
      { webUrl: 'https://example.com' },
    );
  }
  const install = join(extracted, 'package/install.mjs');
  await assert.rejects(
    exec(process.execPath, [install, '--target', 'agents'], { env }),
    /already installed/,
  );
  await exec(process.execPath, [install, '--target', 'agents', '--yes'], {
    env,
  });
  const site = JSON.parse(
    await readFile(join(home, '.agents/skills/demo-agent/site.json'), 'utf8'),
  ) as { webUrl: string };
  assert.equal(site.webUrl, 'https://example.com');
});
