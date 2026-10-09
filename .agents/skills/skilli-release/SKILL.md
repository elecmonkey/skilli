---
name: skilli-release
description: Prepare a Skilli release PR, publish its fixed commit through GitHub Actions, and tag that commit before merging. Use when releasing Skilli or changing its release workflow.
---

# Skilli releases

Read `.github/workflows/release.yml` and follow the authorization rules in `AGENTS.md`.

Keep all four packages on the same version: `skilli`, `@skilli/installer`, `@skilli/plugin-vite`, and `@skilli/plugin-rsbuild`. The installer remains private and is bundled into skilli.

1. Determine the next version from the user’s requested `patch`, `minor`, or `major` bump, or use their explicit target version. Create branch `release/v<version>` and update all four package versions.
2. Run `pnpm test` and `pnpm check`.
3. Open a PR to `main` from that branch in `elecmonkey/skilli`, titled `chore: release v<version>`, and wait for CI and review.
4. Run the `Release` workflow from `main`, entering the PR number. It publishes the fixed PR commit and creates `v<version>` at that same commit.
5. After the workflow succeeds, merge the PR. Later changes to `main` do not affect the release tag.

Stable versions use the npm tag `latest`; `alpha`, `beta`, and `rc` versions use their corresponding tags. Other prereleases use `next`.

Retry failed releases using the same commit and version. Code changes after publishing require a new version.
