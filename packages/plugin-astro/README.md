# @skilli/plugin-astro

Build an npx-installable Skill package alongside your Astro website.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { skilli } from '@skilli/plugin-astro';

export default defineConfig({
  integrations: [
    skilli({
      skillDir: './skills/my-agent',
      cli: { entry: './src/cli.ts' },
      filename: 'downloads/my-agent-installer.tgz',
    }),
  ],
});
```

Runs during production builds and emits the archive into the public output: `outDir` for static sites and `build.client` for SSR. Inputs resolve relative to Astro's project `root`, or the explicit `root` option. The default filename is `downloads/skill-installer.tgz`. Requires Astro `>=7.3.8 <8` and Node.js 24.3.0+. See [skilli](../skilli/README.md) for shared packaging options.

Use Astro's base path to link to the installer:

```astro
---
const installerUrl = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}downloads/my-agent-installer.tgz`;
---

<a href={installerUrl}>Install the skill</a>
```

With `base: '/app/'`, the URL is `/app/downloads/my-agent-installer.tgz`. `build.assetsPrefix` does not rewrite this link; upload the archive and use an explicit URL for CDN hosting. Static builds and Node adapter standalone SSR are tested; verify the deployed public output when using other adapters.
