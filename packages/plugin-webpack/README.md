# @skilli/plugin-webpack

Build an npx-installable Skill package alongside your website with Webpack 5.

```js
import { SkilliPlugin } from '@skilli/plugin-webpack';

export default {
  mode: 'production',
  context: import.meta.dirname,
  entry: './src/index.js',
  output: {
    path: `${import.meta.dirname}/dist`,
    publicPath: '/app/',
  },
  plugins: [
    new SkilliPlugin({
      skillDir: './skills/my-agent',
      cli: { entry: './src/cli.ts' },
      filename: 'downloads/my-agent-installer.tgz',
    }),
  ],
};
```

The plugin runs in production mode, including Webpack's default when `mode` is omitted. It skips `development`, `none`, and child compilers. Inputs are resolved relative to `compiler.context`, or the explicit `root` option. The default archive name is `downloads/skill-installer.tgz`. Requires Node.js 24.3.0+. See `skilli` for the shared packaging options.

The archive is emitted as a compilation asset and written through Webpack's output filesystem. Packaging errors and existing asset-name collisions fail the build. When using multiple configurations, add the plugin only to the client configuration that serves the download. Each compiler with the plugin packages its own archive; give archives distinct names when compilers share an output directory.

Keep `filename` relative to the output directory, without `output.publicPath`. In browser code, use Webpack's public path to construct the installation command, including on nested routes:

```js
const installerUrl = new URL(
  `${__webpack_public_path__}downloads/my-agent-installer.tgz`,
  window.location.origin,
);
const installCommand = `npx -y ${installerUrl.href}`;
```

Set `output.publicPath` to an absolute pathname such as `/app/` or a full CDN URL for this example. With `publicPath: 'auto'`, Webpack derives the prefix from the executing bundle's URL; ensure the bundle and archive use the same deployment root. Relative public paths require resolving the URL against the deployment root explicitly.
