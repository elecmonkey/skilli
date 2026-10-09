# Skilli

Bundle your CLI, ship your Skill.

```ts
import { packSkill } from 'skilli';

await packSkill({
  skillDir: './skills/my-agent',
  cli: { entry: './src/cli.ts' },
  outDir: 'dist',
  filename: 'downloads/my-agent-installer.tgz',
});
```

Or run `skilli ./skills/my-agent --entry ./src/cli.ts`.

The generated npm tarball includes a standalone installer and the skill. Website users install it with `npx -y https://example.com/downloads/my-agent-installer.tgz`. Requires Node.js 24.3.0+. Use `--target agents|claude|all` for non-interactive installation; `--yes` permits replacing an existing skill. Optional `--site URL` writes `{ "webUrl": "…" }` to the installed skill's `site.json`.

Omit `cli` to package existing scripts. Credentials and business workflows belong to your project. See `@skilli/plugin-rsbuild` and `@skilli/plugin-vite` for website build integration.
