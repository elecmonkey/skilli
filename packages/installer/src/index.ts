import { confirm, multiselect, isCancel } from '@clack/prompts';
import {
  cp,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

async function exists(path: string) {
  try {
    return await lstat(path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw e;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      target: { type: 'string' },
      yes: { type: 'boolean' },
      site: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'Install the bundled skill. --target agents|claude|all --yes --site https://example.com',
    );
    return;
  }

  let site: string | undefined;
  if (values.site) {
    const url = new URL(values.site);
    if (
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        )) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'Site must use HTTPS (HTTP allowed on loopback), without credentials, query or fragment.',
      );
    }
    site = url.href.replace(/\/+$/, '');
  }

  const base = dirname(fileURLToPath(import.meta.url));
  const raw: unknown = JSON.parse(
    await readFile(join(base, 'package.json'), 'utf8'),
  );
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('skilli' in raw) ||
    !raw.skilli ||
    typeof raw.skilli !== 'object' ||
    !('skillName' in raw.skilli)
  ) {
    throw new Error('Invalid installer metadata.');
  }
  const name: unknown = raw.skilli.skillName;
  if (
    typeof name !== 'string' ||
    name.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
  ) {
    throw new Error('Invalid bundled skill name.');
  }
  const source = join(base, name);
  await readFile(join(source, 'SKILL.md'));
  const targets = {
    agents: join(homedir(), '.agents', 'skills', name),
    claude: join(homedir(), '.claude', 'skills', name),
  };
  type Target = keyof typeof targets;
  let selected: Target[];
  if (values.target) {
    if (!['agents', 'claude', 'all'].includes(values.target)) {
      throw new Error('Target must be agents, claude or all.');
    }
    selected =
      values.target === 'all'
        ? ['agents', 'claude']
        : [values.target as Target];
  } else {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error(
        'Pass --target agents, claude or all in a non-interactive terminal.',
      );
    }
    const answer = await multiselect({
      message: 'Select the Agents to install the Skill for',
      options: [
        {
          value: 'agents' as const,
          label: 'Codex / .agents',
        },
        {
          value: 'claude' as const,
          label: 'Claude Code',
        },
      ],
      required: true,
    });
    if (isCancel(answer)) {
      return;
    }
    selected = answer;
  }

  // Validate every target before starting any installation.
  let updating = false;
  for (const id of selected) {
    const stat = await exists(targets[id]);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
      throw new Error(`Refusing to replace ${targets[id]}.`);
    }
    updating ||= Boolean(stat);
  }

  if (updating && !values.yes) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error('Skill already installed. Pass --yes to replace it.');
    }
    const answer = await confirm({
      message:
        'Updating will replace all contents of the existing Skill directories. Continue?',
      initialValue: false,
    });
    if (isCancel(answer) || !answer) {
      return;
    }
  }

  for (const id of selected) {
    const target = targets[id];
    const parent = dirname(target);
    await mkdir(parent, { recursive: true });
    const staged = join(parent, `.skilli-new-${randomUUID()}`);
    const backup = join(parent, `.skilli-old-${randomUUID()}`);
    let backedUp = false;
    try {
      await cp(source, staged, { recursive: true });
      if (site) {
        await writeFile(
          join(staged, 'site.json'),
          JSON.stringify({ webUrl: site }, null, 2) + '\n',
        );
      } else if (await exists(join(target, 'site.json'))) {
        await cp(join(target, 'site.json'), join(staged, 'site.json'));
      }
      if (await exists(target)) {
        await rename(target, backup);
        backedUp = true;
      }
      try {
        await rename(staged, target);
      } catch (error) {
        if (backedUp) {
          await rename(backup, target);
        }
        throw error;
      }
      if (backedUp) {
        await rm(backup, { recursive: true, force: true });
      }
      console.log(`Installed: ${target}`);
    } finally {
      await rm(staged, { recursive: true, force: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
