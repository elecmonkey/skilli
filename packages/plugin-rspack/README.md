# @skilli/plugin-rspack

Build an npx-installable Skill package alongside your Rspack website.

```js
import { SkilliPlugin } from '@skilli/plugin-rspack';

const plugin = new SkilliPlugin({
  skillDir: './skills/my-agent',
  cli: { entry: './src/cli.ts' },
  filename: 'downloads/my-agent-installer.tgz',
});
```

Add `plugin` to your Rspack configuration's `plugins` array. Runs in production mode, including when `mode` is omitted. Inputs resolve relative to `compiler.context`, or the explicit `root` option. The default filename is `downloads/skill-installer.tgz`, relative to the build output. Requires Rspack 2 and Node.js 24.3.0+. See [skilli](../skilli/README.md) for shared packaging options.

For separate client and server builds, add the plugin to the client configuration. Packaging errors and archive filename collisions fail the build.

Use the configured public path to create the installation command in browser code:

```js
const installerUrl = new URL(
  `${__webpack_public_path__}downloads/my-agent-installer.tgz`,
  window.location.origin,
);
const installCommand = `npx -y ${installerUrl.href}`;
```

Use a `publicPath` ending in `/`, such as `/app/` or `https://cdn.example.com/app/`, and upload the installer alongside the other assets. With `publicPath: 'auto'`, the archive must share the bundle's resolved public path.
