# Examples

Each example has a website and an Agent Skill that share the same greeting function. Its production build adds a self-contained installer to `dist/downloads/`.

From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter @skilli/example-vite preview
```

For Rsbuild, use `pnpm --filter @skilli/example-rsbuild preview`. Open the preview page and copy its installation command. The installer is generated during production builds, so use preview to try the download.

- [Vite configuration](vite-project/vite.config.ts)
- [Rsbuild configuration](rsbuild-project/rstack.config.ts)

For SSR applications, generate the installer with the client build and serve its `downloads/` directory as a public static asset. Server build output alone is not necessarily accessible from the website.
