# @skilli/plugin-rsbuild

Build an npx-installable Skill package alongside your website.

```ts
import { pluginSkilli } from '@skilli/plugin-rsbuild';

const plugin = pluginSkilli({
  skillDir: './skills/my-agent',
  cli: { entry: './src/cli.ts' },
  filename: 'downloads/my-agent-installer.tgz',
});
```

Add `plugin` to your website's `plugins` array. Runs during production builds only. Inputs are resolved relative to the website root, or the explicit `root` option. Requires Node.js 24.3.0+. See `skilli` for the shared packaging options.

Keep `filename` relative to the build output, without the website base path. In browser code, use the configured asset prefix to create the installation command, including on nested routes:

```ts
const installerUrl = new URL(
  `${import.meta.env.ASSET_PREFIX}/downloads/my-agent-installer.tgz`,
  window.location.origin,
);
const installCommand = `npx -y ${installerUrl.href}`;
```

Configure `output.assetPrefix` for the deployed asset location. If it points to a CDN, upload the installer there alongside the other build assets.
