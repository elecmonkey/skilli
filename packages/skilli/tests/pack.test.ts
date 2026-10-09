import { test, afterEach } from 'rstack/test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from 'node:fs/promises';
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
const fixture = resolve('tests/fixtures/demo-agent');
const entry = resolve('tests/fixtures/cli/index.ts');
async function temporary(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'skilli-test-'));
  cleanup.push(dir);
  return dir;
}

test('archive includes a runnable bundled CLI and an npm installer entry', async () => {
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
});

test('invalid paths and symlinks cannot enter the package', async () => {
  const dir = await temporary();
  await assert.rejects(
    packSkill({ skillDir: fixture, outDir: dir, filename: '../escape.tgz' }),
    /safe relative/,
  );
  await assert.rejects(
    packSkill({
      skillDir: fixture,
      outDir: dir,
      cli: { entry, filename: '../../escape.mjs' },
    }),
    /safe relative/,
  );
  const skill = join(dir, 'demo-agent');
  await mkdir(skill);
  await writeFile(
    join(skill, 'SKILL.md'),
    await readFile(join(fixture, 'SKILL.md')),
  );
  await symlink(entry, join(skill, 'linked.ts'));
  await assert.rejects(
    packSkill({ skillDir: skill, outDir: join(dir, 'output') }),
    /Unsupported skill entry/,
  );
});

test('an existing CLI can be packaged without an esbuild entry', async () => {
  const dir = await temporary();
  const result = await packSkill({ skillDir: fixture, outDir: dir });
  assert.equal(result.skillName, 'demo-agent');
});
