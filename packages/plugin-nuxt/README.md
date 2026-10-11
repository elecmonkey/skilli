# @skilli/plugin-nuxt

Build an npx-installable Skill package alongside your Nuxt website.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@skilli/plugin-nuxt'],
  skilli: {
    skillDir: './skills/my-agent',
    cli: { entry: './src/cli.ts' },
    filename: 'downloads/my-agent-installer.tgz',
  },
});
```

The module runs during production builds and static generation. It packages the Skill before Nitro prerenders or copies public assets, so the archive is included in the deployed `.output/public` directory. Development does not generate an archive or install a Skill. Inputs resolve relative to Nuxt's `rootDir`, or the explicit `root` option. The default filename is `downloads/skill-installer.tgz`. See `skilli` for the shared packaging options.

Requires Nuxt 4.6.1 or later within Nuxt 4 and Node.js 24.15.0 or later. Nitro public assets must be enabled.

Keep `filename` relative to the public output, without the deployment base path. Build the installation URL using Nuxt's configured base URL, including on nested routes:

```ts
const { app } = useRuntimeConfig();
const assetBase = app.cdnURL || app.baseURL;
const installerUrl = new URL(
  `${assetBase.replace(/\/$/, '')}/downloads/my-agent-installer.tgz`,
  window.location.origin,
);
const installCommand = `npx -y ${installerUrl.href}`;
```

Use an absolute pathname such as `/app/` for `app.baseURL`. When using `app.cdnURL`, upload the public output, including the installer archive, to that CDN prefix. The URL example belongs in browser code or a client event handler, where `window` is available.
