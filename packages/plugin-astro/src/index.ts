import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { skilli as viteSkilli } from '@skilli/plugin-vite';
import type { SkilliOptions } from 'skilli';

export function skilli(options: SkilliOptions): AstroIntegration {
  let root = process.cwd();
  return {
    name: '@skilli/plugin-astro',
    hooks: {
      'astro:config:done'({ config }) {
        root = fileURLToPath(config.root);
      },
      'astro:build:setup'({ updateConfig }) {
        // Astro 7 configures all Vite environments in this hook. Emit only in
        // the client build, before adapters package or copy public assets.
        updateConfig({
          plugins: [
            {
              ...viteSkilli({ ...options, root: options.root ?? root }),
              applyToEnvironment(environment) {
                return environment.name === 'client';
              },
            },
          ],
        });
      },
    },
  };
}

export default skilli;
