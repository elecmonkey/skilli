import { build, type BuildOptions } from 'esbuild';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  rename,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { create } from 'tar';
import { parse } from 'yaml';

export interface SkilliOptions {
  /** Directory containing SKILL.md. Relative to root. */
  skillDir: string;
  root?: string;
  cli?: {
    entry: string;
    filename?: string;
    esbuild?: Omit<
      BuildOptions,
      | 'entryPoints'
      | 'outfile'
      | 'outdir'
      | 'write'
      | 'bundle'
      | 'platform'
      | 'format'
      | 'packages'
      | 'splitting'
    >;
  };
  /** Archive path relative to the website output directory. */
  filename?: string;
  version?: string;
}

export interface PackOptions extends SkilliOptions {
  outDir?: string;
}

export interface PackResult {
  archivePath: string;
  filename: string;
  skillName: string;
}

export function safeRelative(value: string): string {
  if (
    !value ||
    isAbsolute(value) ||
    value.includes('\\') ||
    value.split('/').some((x) => x === '..' || x === '.' || x === '') ||
    /^[A-Za-z]:/.test(value)
  ) {
    throw new Error(`Expected a safe relative path: ${value}`);
  }
  return value;
}

async function validateTree(directory: string): Promise<void> {
  for (const entry of await readdir(directory)) {
    if (entry === 'node_modules' || entry === '.git') {
      throw new Error(`Exclude ${entry} from the skill directory.`);
    }

    const path = join(directory, entry);
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw new Error(`Unsupported skill entry: ${path}`);
    }

    if (stat.isDirectory()) {
      await validateTree(path);
    }
  }
}

export async function packSkill(options: PackOptions): Promise<PackResult> {
  const root = resolve(options.root ?? process.cwd());
  const source = resolve(root, options.skillDir);
  await validateTree(source);
  const markdown = await readFile(join(source, 'SKILL.md'), 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!frontmatter) {
    throw new Error('SKILL.md needs YAML frontmatter.');
  }
  const raw: unknown = parse(frontmatter[1]);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid skill metadata.');
  }
  const metadata = raw as Record<string, unknown>;
  const name: unknown = metadata.name;
  if (
    typeof name !== 'string' ||
    name.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
  ) {
    throw new Error('Invalid skill name.');
  }
  if (basename(source) !== name) {
    throw new Error('Skill name must match its directory name.');
  }
  if (
    typeof metadata.description !== 'string' ||
    !metadata.description.trim() ||
    metadata.description.length > 1024
  ) {
    throw new Error('Skill description must contain 1–1024 characters.');
  }

  const filename = safeRelative(options.filename ?? `${name}-installer.tgz`);
  if (!filename.endsWith('.tgz')) {
    throw new Error('Archive filename must end in .tgz.');
  }

  const version = options.version ?? '0.1.0';
  if (
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)
  ) {
    throw new Error('Invalid package version.');
  }

  const archivePath = resolve(root, options.outDir ?? 'dist', filename);
  const outputRelative = relative(source, archivePath);
  if (!outputRelative.startsWith('..') && !isAbsolute(outputRelative)) {
    throw new Error(
      'Archive output must be outside the source skill directory.',
    );
  }

  const temporary = await mkdtemp(join(tmpdir(), 'skilli-'));
  const pending = `${archivePath}.${randomUUID()}.tmp`;
  try {
    const packageDir = join(temporary, 'package');
    const skillDir = join(packageDir, name);
    await mkdir(packageDir);
    await cp(source, skillDir, { recursive: true });
    if (options.cli) {
      const cliFilename = safeRelative(options.cli.filename ?? 'cli.mjs');
      if (!cliFilename.endsWith('.mjs')) {
        throw new Error('CLI filename must end in .mjs.');
      }
      await build({
        minify: true,
        ...options.cli.esbuild,
        absWorkingDir: root,
        entryPoints: [resolve(root, options.cli.entry)],
        outfile: join(skillDir, 'scripts', cliFilename),
        write: true,
        bundle: true,
        packages: 'bundle',
        splitting: false,
        platform: 'node',
        format: 'esm',
        target: options.cli.esbuild?.target ?? 'node24.3',
      });
    }

    await cp(
      join(dirname(fileURLToPath(import.meta.url)), 'assets', 'install.mjs'),
      join(packageDir, 'install.mjs'),
    );
    await writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify(
        {
          name: `${name}-installer`,
          version,
          type: 'module',
          bin: { [`${name}-install`]: 'install.mjs' },
          engines: { node: '>=24.3.0' },
          skilli: { skillName: name },
        },
        null,
        2,
      ),
    );

    await mkdir(dirname(archivePath), { recursive: true });
    await create(
      {
        gzip: true,
        file: pending,
        cwd: temporary,
        portable: true,
        mtime: new Date(0),
      },
      ['package'],
    );
    await rename(pending, archivePath);
    return { archivePath, filename, skillName: name };
  } finally {
    await rm(temporary, { recursive: true, force: true });
    await rm(pending, { force: true });
  }
}
