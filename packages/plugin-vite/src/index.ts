import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packSkill, type SkilliOptions } from 'skilli';
import type { Plugin } from 'vite';

export function skilli(options: SkilliOptions): Plugin {
  let root = process.cwd();
  return {
    name: '@skilli/plugin-vite',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    async generateBundle() {
      const temporary = await mkdtemp(join(tmpdir(), 'skilli-vite-'));
      try {
        const result = await packSkill({
          ...options,
          root: options.root ?? root,
          filename: options.filename ?? 'downloads/skill-installer.tgz',
          outDir: temporary,
        });
        this.emitFile({
          type: 'asset',
          fileName: result.filename,
          source: await readFile(result.archivePath),
        });
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    },
  };
}

export default skilli;
