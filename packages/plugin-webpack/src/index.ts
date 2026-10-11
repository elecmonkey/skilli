import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packSkill, type SkilliOptions } from 'skilli';
import type { Compiler } from 'webpack';

const pluginName = '@skilli/plugin-webpack';

export class SkilliPlugin {
  private readonly options: SkilliOptions;

  constructor(options: SkilliOptions) {
    this.options = options;
  }

  apply(compiler: Compiler): void {
    // Webpack defaults to production when mode is omitted.
    if (
      compiler.isChild() ||
      (compiler.options.mode !== undefined &&
        compiler.options.mode !== 'production')
    ) {
      return;
    }

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: pluginName,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        async () => {
          const filename =
            this.options.filename ?? 'downloads/skill-installer.tgz';
          if (compilation.getAsset(filename)) {
            throw new Error(`${pluginName}: Asset already exists: ${filename}`);
          }

          const temporary = await mkdtemp(join(tmpdir(), 'skilli-webpack-'));
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
