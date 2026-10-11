# @skilli/plugin-astro

Package an Agent Skill and its bundled CLI as an npm installer tarball during an Astro production build.

```bash
pnpm add -D @skilli/plugin-astro
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { skilli } from '@skilli/plugin-astro';

export default defineConfig({
  integrations: [
    skilli({
      skillDir: './skills/demo-agent',
      cli: { entry: './cli/index.ts' },
      filename: 'downloads/skill-installer.tgz',
    }),
  ],
});
```

`skillDir` and `cli.entry` resolve from Astro's project `root`, including when it differs from the working directory. Set the integration's `root` option to override that directory. `filename` defaults to `downloads/skill-installer.tgz` and must be a safe relative `.tgz` path. Other options use the [Skilli packaging API](../skilli/README.md).

The integration adds Skilli's Vite asset plugin during `astro:build:setup` and restricts it to Astro's client environment. The client build emits the tarball into the public output directory before adapters package or copy public assets: `outDir` for a static site and `build.client` for a server build. Custom output directories are supported. Packaging errors fail the build. Development and preview servers do not generate an archive.

Create links from Astro's base path so they also work on nested pages:

```astro
---
const installerUrl =
  import.meta.env.BASE_URL.replace(/\/?$/, '/') +
  'downloads/skill-installer.tgz';
---

<a href={installerUrl}>Install the skill</a>
```

For `base: '/app/'`, the public URL is `/app/downloads/skill-installer.tgz`. The archive remains at `downloads/skill-installer.tgz` inside the public output directory. Configure your host to serve that directory at the base path.

Astro's `build.assetsPrefix` controls generated assets such as JavaScript and CSS. It does not move this public download or rewrite the link above. If a CDN serves your downloads, upload the archive there and use that explicit CDN URL in your page.

Compatibility is tested with Astro 7.3.8 for static builds and `@astrojs/node` 11.1.7 in standalone SSR mode, including a download through the production server. The Astro peer range is `>=7.3.8 <8`. Other adapters and adapter modes have not been tested; verify the archive reaches their deployed static output. Adapters that copy public assets in `astro:build:done` receive the archive before that hook runs.
