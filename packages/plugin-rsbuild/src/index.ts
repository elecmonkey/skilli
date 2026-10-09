import { packSkill, type SkilliOptions } from 'skilli';
import type { RsbuildPlugin } from '@rsbuild/core';

export function pluginSkilli(options: SkilliOptions): RsbuildPlugin {
  return {
    name: '@skilli/plugin-rsbuild',
    apply: 'build',
    setup(api) {
      api.onAfterBuild(async () => {
        await packSkill({
          ...options,
          root: options.root ?? api.context.rootPath,
          filename: options.filename ?? 'downloads/skill-installer.tgz',
          outDir: api.context.distPath,
        });
      });
    },
  };
}

export default pluginSkilli;
