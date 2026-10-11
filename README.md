# Skilli

A SKILL with CLI is your application's second frontend.

Skilli bundles your CLI, Skill, and installer into an npm tarball that users can install from your website with one command.

```ts title="vite.config.ts"
import { defineConfig } from 'vite';
import skilli from '@skilli/plugin-vite';

export default defineConfig({
  plugins: [
    skilli({
      skillDir: './skills/my-agent',
      cli: { entry: './src/cli.ts' },
      filename: 'downloads/my-agent-installer.tgz',
    }),
  ],
});
```

Share this installation command with your users on your website:

```sh
npx -y https://example.com/downloads/my-agent-installer.tgz
```

Use [@skilli/plugin-rsbuild](packages/plugin-rsbuild/README.md) or [@skilli/plugin-vite](packages/plugin-vite/README.md) to generate the archive during your website build. See [skilli](packages/skilli/README.md) for packaging and installation options.

## License

MIT
