# @skilli/plugin-rspack

Package an Agent Skill and its CLI as an installer archive during a Rspack
production build. Requires Rspack 2 and Node.js 24.3 or later.

```bash
pnpm add -D @skilli/plugin-rspack
```

```js
// rspack.config.mjs
import { SkilliPlugin } from '@skilli/plugin-rspack';

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
      skillDir: './skills/demo-agent',
      cli: { entry: './cli/index.ts' },
    }),
  ],
};
```

`skillDir` and `cli.entry` resolve relative to `compiler.context`. Set `root` to
override that directory. The skill directory must contain `SKILL.md` with valid
YAML frontmatter, and its directory name must match the skill name.

The default archive is `downloads/skill-installer.tgz` relative to `output.path`.
Set `filename` to another relative `.tgz` path. The plugin accepts the
[`SkilliOptions`](../skilli/README.md) packaging options, including `version` and
`cli.esbuild`. It also has a default export.

The archive is emitted as a compilation asset, so Rspack writes it through the
configured output filesystem, including memory filesystems. An existing asset
with the same filename fails the build. Temporary packaging files are removed
after success or failure. The plugin runs when `mode` is `production` or omitted
(Rspack's production default), and skips child compilers.

For a client/server or multi-compiler build, add the plugin to the browser
configuration that serves downloads. Each configured production compiler emits
its own archive; use separate output directories or filenames if multiple
compilers need installers. Rspack watch builds with production mode package an
archive on each compilation.

## Link to the installer

Use Rspack's runtime public path to build the download URL in browser code:

```js
const installerUrl = new URL(
  `${__webpack_public_path__}downloads/skill-installer.tgz`,
  window.location.origin,
).href;

document.querySelector('#install').href = installerUrl;
```

Keep the archive filename in this code consistent with the plugin's `filename`.
Use a `publicPath` ending in `/`, such as `/app/` or
`https://cdn.example.com/app/`, so the link works on nested routes. Upload the
installer archive alongside the other emitted assets when using a CDN. With
`publicPath: 'auto'`, Rspack derives the prefix from the loaded browser script;
the archive must be served under that same prefix.

Users can install the skill from the hosted archive:

```bash
npx https://example.com/app/downloads/skill-installer.tgz
```
