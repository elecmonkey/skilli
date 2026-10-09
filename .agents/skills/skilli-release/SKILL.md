---
name: skilli-release
description: Prepare a Skilli release PR, publish its fixed commit through GitHub Actions, and tag that commit before merging. Use when releasing Skilli or changing its release workflow.
---

# Skilli releases

Read `.github/workflows/release.yml` and follow the authorization rules in `AGENTS.md`.

Keep all six packages on the same version: `skilli`, `@skilli/installer`, `@skilli/plugin-vite`, `@skilli/plugin-rsbuild`, `@skilli/plugin-astro`, and `@skilli/plugin-nuxt`. The installer remains private and is bundled into skilli. New packages start at the current shared version; `@skilli/plugin-astro` and `@skilli/plugin-nuxt` initially use `0.1.2`. When adding a package, update this list and the release workflow's version-validation list together.

1. Determine the next version from the user’s requested `patch`, `minor`, or `major` bump, or use their explicit target version. Create branch `release/v<version>` and update all six package versions, including `@skilli/plugin-astro` and `@skilli/plugin-nuxt`.
2. Run `pnpm test` and `pnpm check`.
3. Open a PR to `main` from that branch in `elecmonkey/skilli`, titled `chore: release v<version>`, and wait for CI and review.
4. For a new public package, publish its first version locally from the fixed, validated release PR commit using `pnpm --filter <package-name> publish --access public --no-git-checks --tag <dist-tag>`. Then configure npm trusted publishing for this repository's `release.yml` workflow. Obtain explicit authorization for each external action before publishing or changing npm settings.
5. Run the `Release` workflow from `main`, entering the PR number. It validates every package's version and checks that any already-published version has the same `gitHead`, publishes the remaining packages from the fixed PR commit, creates `v<version>` at that same commit, and publishes a GitHub Release.
6. After the workflow succeeds, merge the PR. Later changes to `main` do not affect the release tag.

Stable versions use the npm tag `latest`; `alpha`, `beta`, and `rc` versions use their corresponding tags. Other prereleases use `next`.

Retry failed releases using the same commit and version. Code changes after publishing require a new version.

## Release notes

Summarize user-facing changes since the previous release, ending at the published tag. Review the complete commit history in that range, including direct commits without PRs; for the first release, review history up to the published tag. Write in English using this exact section order and bullet format; omit empty sections and routine release chores. Describe new capabilities under Features, corrected behavior under Bug Fixes, and incompatible changes with migration instructions under Breaking Changes.

```md
## Breaking Changes

- <Incompatible change>. Migration: <required action>. ([#123](https://github.com/elecmonkey/skilli/pull/123))

## Features

- <New capability and its use>. ([#124](https://github.com/elecmonkey/skilli/pull/124))

## Bug Fixes

- <Affected scenario and corrected behavior>. ([#125](https://github.com/elecmonkey/skilli/pull/125))

**Full Changelog**: https://github.com/elecmonkey/skilli/compare/v<previous>...v<current>
```

Use one concise bullet per change. Link to its PR when available; otherwise use `([<short SHA>](https://github.com/elecmonkey/skilli/commit/<full SHA>))`. Include each change once, even when both PR and commit records describe it. Do not add emojis, introductory paragraphs, or extra sections. For the first release, omit Full Changelog if there is no previous tag.
