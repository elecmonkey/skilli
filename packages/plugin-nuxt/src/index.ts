import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { defineNuxtModule } from '@nuxt/kit';
import type { NitroConfig, NuxtModule } from '@nuxt/schema';
import { packSkill, type SkilliOptions } from 'skilli';

declare module '@nuxt/schema' {
  interface NuxtConfig {
    skilli?: SkilliOptions;
  }

  interface NuxtOptions {
    skilli?: SkilliOptions;
  }
}

export const skilli: NuxtModule<SkilliOptions> =
  defineNuxtModule<SkilliOptions>({
    meta: {
      name: '@skilli/plugin-nuxt',
      configKey: 'skilli',
      compatibility: { nuxt: '>=4.6.1 <5' },
    },
    setup(options, nuxt) {
      if (nuxt.options.dev) {
        return;
      }
      if (!options.skillDir) {
        throw new Error('@skilli/plugin-nuxt requires a skillDir option.');
      }

      const publicDir = join(nuxt.options.buildDir, 'skilli/public');
      nuxt.hook(
        'nitro:config',
        (
          config: NitroConfig & {
            noPublicDir?: boolean;
            publicAssets?: { dir: string; baseURL?: string }[];
          },
        ) => {
          if (config.noPublicDir) {
            throw new Error(
              '@skilli/plugin-nuxt requires Nitro public assets (noPublicDir must be false).',
            );
          }
          config.publicAssets ??= [];
          config.publicAssets.push({ dir: publicDir, baseURL: '/' });
        },
      );
      nuxt.hook('nitro:build:before', async () => {
        await rm(publicDir, { recursive: true, force: true });
        await packSkill({
          ...options,
          root: options.root ?? nuxt.options.rootDir,
          filename: options.filename ?? 'downloads/skill-installer.tgz',
          outDir: publicDir,
        });
      });
    },
  });

export default skilli;
