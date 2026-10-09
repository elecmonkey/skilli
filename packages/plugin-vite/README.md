# @skilli/plugin-vite

Build an npx-installable Skill package alongside your website.

```ts
import skilli from '@skilli/plugin-vite';

const plugin = skilli({
  skillDir: './skills/my-agent',
  cli: { entry: './src/cli.ts' },
  filename: 'downloads/my-agent-installer.tgz',
});
```

Add `plugin` to your website's `plugins` array. Runs during production builds only. Inputs are resolved relative to the website root, or the explicit `root` option. Requires Node.js 24.3.0+. See `skilli` for the shared packaging options.
