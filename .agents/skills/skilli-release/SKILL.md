---
name: skilli-release
description: Prepare a Skilli release PR, publish its fixed commit through GitHub Actions, and tag that commit before merging. Use when releasing Skilli or changing its release workflow.
---

# Skilli releases

Read `.github/workflows/release.yml` and follow the authorization rules in `AGENTS.md`.

Keep all five packages on the same version: `skilli`, `@skilli/installer`, `@skilli/plugin-vite`, `@skilli/plugin-rsbuild`, and `@skilli/plugin-astro`. The installer remains private and is bundled into skilli. New packages start at the current shared version; `@skilli/plugin-astro` initially uses `0.1.2`. When adding a package, update this list and the release workflow's version-validation list together.

1. Determine the next version from the user’s requested `patch`, `minor`, or `major` bump, or use their explicit target version. Create branch `release/v<version>` and update all five package versions, including `@skilli/plugin-astro`.
2. Run `pnpm test` and `pnpm check`.
3. Open a PR to `main` from that branch in `elecmonkey/skilli`, titled `chore: release v<version>`, and wait for CI and review.
4. For a new public package, publish its first version locally from the fixed, validated release PR commit using `pnpm --filter <package-name> publish --access public --no-git-checks --tag <dist-tag>`. Then configure npm trusted publishing for this repository's `release.yml` workflow. Obtain explicit authorization for each external action before publishing or changing npm settings.
5. Run the `Release` workflow from `main`, entering the PR number. It validates every package's version and checks that any already-published version has the same `gitHead`, publishes the remaining packages from the fixed PR commit, creates `v<version>` at that same commit, and publishes a GitHub Release.
6. After the workflow succeeds, merge the PR. Later changes to `main` do not affect the release tag.

Stable versions use the npm tag `latest`; `alpha`, `beta`, and `rc` versions use their corresponding tags. Other prereleases use `next`.

Retry failed releases using the same commit and version. Code changes after publishing require a new version.
