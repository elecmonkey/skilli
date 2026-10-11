import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packSkill, safeRelative, type SkilliOptions } from 'skilli';
import type { Compiler } from '@rspack/core';

const pluginName = '@skilli/plugin-rspack';

export class SkilliPlugin {
  private readonly options: SkilliOptions;

  constructor(options: SkilliOptions) {
    this.options = options;
  }

  apply(compiler: Compiler): void {
    if (
      (compiler.options.mode !== undefined &&
        compiler.options.mode !== 'production') ||
      compiler.isChild()
    ) {
      return;
    }

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      if (compilation.compiler !== compiler || compilation.compiler.isChild()) {
        return;
      }

      compilation.hooks.processAssets.tapPromise(
        {
          name: pluginName,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        async () => {
          const filename = safeRelative(
            this.options.filename ?? 'downloads/skill-installer.tgz',
          );
          if (compilation.getAsset(filename)) {
            throw new Error(`${pluginName}: Asset already exists: ${filename}`);
          }

          const temporary = await mkdtemp(join(tmpdir(), 'skilli-rspack-'));
          try {
            const result = await packSkill({
              ...this.options,
              root: this.options.root ?? compiler.context,
              filename,
              outDir: temporary,
            });
            compilation.emitAsset(
              result.filename,
              new compiler.webpack.sources.RawSource(
                await readFile(result.archivePath),
              ),
            );
          } finally {
            await rm(temporary, { recursive: true, force: true });
          }
        },
      );
    });
  }
}

export default SkilliPlugin;
