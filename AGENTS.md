# Skilli

A SKILL with CLI is an application's second frontend. This pnpm monorepo packages it for installation from a website.

## Architecture

- `packages/skilli`: packaging API, CLI, and bundled installer asset. Uses esbuild to bundle users' CLIs.
- `packages/installer`: private TypeScript installer source, bundled directly into an asset by skilli’s `rs lib` build; never published separately.
- `packages/plugin-rsbuild` and `packages/plugin-vite`: website build integrations.

## Toolchain

- Use Rstack CLI for all repository tooling. Reference: `node_modules/rstack/docs/llms.txt` or https://rstack.rs/llms.txt.
- Build with `rs lib`. Use `dts: { isolated: true }` for declarations and do not add a `typescript` dependency.
- Keep tests in each package's `tests/` directory, written in TypeScript and run with `rs test`.
- Manage external dependency versions through pnpm catalogs and internal dependencies through `workspace:`. Each package using Rstack must declare it as a development dependency.

## Validation

- Run `pnpm check` after changes; it includes linting, type checking, and formatting checks.
- Run `pnpm test` after packaging, installer, or plugin changes. It builds skilli (including the installer asset) before the plugins.
- Installer tests must use temporary directories, never the user's actual Skill directories.

## Scope and publishing

- Investigation and explanation requests authorize read-only work; wait for an explicit request before editing.
- Do not commit generated `dist` files or `.tgz` archives.
- Editing, committing, and external publishing require separate authorization. Never push, publish, or write to an external service as the user without explicit authorization for the action and target.
