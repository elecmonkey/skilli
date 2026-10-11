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

Keep `filename` relative to the build output, without the website base path. In browser code, use the configured asset prefix to create the installation command, including on nested routes:

```ts
const installerUrl = new URL(
  `${import.meta.env.BASE_URL}downloads/my-agent-installer.tgz`,
  window.location.origin,
);
const installCommand = `npx -y ${installerUrl.href}`;
```

Use an absolute pathname (such as `/app/`) or a full CDN URL for Vite `base`. Relative bases (`./` or an empty string) require resolving the URL against the deployment root explicitly.
