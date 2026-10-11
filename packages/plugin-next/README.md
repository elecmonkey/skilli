# @skilli/plugin-next

Build an npx-installable Skill package alongside your Next.js website.

```js
// next.config.mjs
import { withSkilli } from '@skilli/plugin-next';

export default withSkilli({
  root: import.meta.dirname,
  skillDir: './skills/my-agent',
  cli: { entry: './src/cli.ts' },
  filename: 'downloads/my-agent-installer.tgz',
})({
  // Your Next.js configuration.
});
```

Accepts an object, a promise, or a configuration function. Runs during production builds with Turbopack or Webpack; `next dev` and `next start` do not generate an archive. Inputs resolve relative to `root`, which defaults to the working directory when `withSkilli` is called. Requires Next.js 16 and Node.js 24.3.0+. See [skilli](../skilli/README.md) for shared packaging options.

The default archive is `public/downloads/skill-installer.tgz`. Keep `filename` relative to `public`. Link to `/downloads/my-agent-installer.tgz`, or `/app/downloads/my-agent-installer.tgz` with `basePath: '/app'`. `assetPrefix` does not prefix public files; use an explicit CDN URL if you host the archive elsewhere.

```sh
npx -y https://example.com/downloads/my-agent-installer.tgz
```

Static exports copy the archive into `out`. Deployments using `next start` must include `public`; standalone deployments must copy it into the standalone application directory or serve it separately. Ignore the generated archive in version control.
