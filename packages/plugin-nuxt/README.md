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

Runs during production builds and static generation, including the archive in Nitro's public output. Inputs resolve relative to Nuxt's `rootDir`, or the explicit `root` option. The default filename is `downloads/skill-installer.tgz`. Requires Nuxt `>=4.6.1 <5`, Node.js 24.15.0+, and Nitro public assets enabled. See [skilli](../skilli/README.md) for shared packaging options.

Keep `filename` relative to the public output. In browser code, use Nuxt's base URL to create the installation command:

```ts
const { app } = useRuntimeConfig();
const assetBase = app.cdnURL || app.baseURL;
const installerUrl = new URL(
  `${assetBase.replace(/\/$/, '')}/downloads/my-agent-installer.tgz`,
  window.location.origin,
);
const installCommand = `npx -y ${installerUrl.href}`;
```

Use an absolute pathname such as `/app/` for `app.baseURL`. When using `app.cdnURL`, upload the public output, including the installer, to that prefix.
