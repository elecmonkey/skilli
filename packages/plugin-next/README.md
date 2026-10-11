# @skilli/plugin-next

Build an Agent Skill installer during a Next.js production build.

```bash
pnpm add -D @skilli/plugin-next
```

Wrap your configuration in `next.config.mjs`:

```js
import { withSkilli } from '@skilli/plugin-next';
import { fileURLToPath } from 'node:url';

export default withSkilli({
  root: fileURLToPath(new URL('.', import.meta.url)),
  skillDir: 'skills/demo-agent',
  cli: { entry: 'cli/index.ts' },
})({
  // Your existing Next.js options.
});
```

`withSkilli(options)(nextConfig)` accepts an object, a promise, or a synchronous
or asynchronous configuration function. Functions receive Next.js's `phase` and
`{ defaultConfig }` arguments. Their returned configuration and existing
callbacks are preserved, so the wrapper also composes with other config wrappers.

The plugin awaits packaging only during `PHASE_PRODUCTION_BUILD`, before Next.js
scans `public`. It supports both Turbopack and webpack without adding bundler
hooks. `next dev` and `next start` do not generate an archive. Packaging errors
reject the configuration and fail the build. Each production configuration load
packages again, including updated source files; there is no process-wide cache.

The default archive is `public/downloads/skill-installer.tgz`. Set `filename` to
change the path relative to `public`, and use the other `SkilliOptions` to
configure the skill, CLI, and version. `root` is the Next.js application
directory and also resolves relative skill and CLI paths. It defaults to the
working directory when `withSkilli` is called. Specify it explicitly when your
command runs from another directory, such as `next build apps/web`.

For a site without `basePath`, link to `/downloads/skill-installer.tgz`. With
`basePath: '/app'`, use `/app/downloads/skill-installer.tgz`; Next.js public asset
URLs need that prefix explicitly. `assetPrefix` applies to `/_next/static`
assets and does not automatically prefix public files. If you host public
files on a CDN, construct the installer URL with that CDN's public asset URL.
Use an absolute URL when passing the archive to `npx`:

```bash
npx --yes https://example.com/app/downloads/skill-installer.tgz
```

Next.js copies `public` into the `out` directory for `output: 'export'`. A
deployment using `next start` must include `public` alongside its build.
`output: 'standalone'` does not automatically copy `public` or `.next/static`;
copy both into the standalone application directory as required by Next.js, or
host public files separately. Other hosting adapters must include or serve the
generated public archive. The plugin creates it in the source application's
`public` directory, so ignore the generated archive in version control.

See the [Next.js configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js),
[public assets](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder),
and [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
documentation for deployment details.
