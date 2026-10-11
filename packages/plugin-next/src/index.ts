import { join, resolve } from 'node:path';
import type { NextConfig } from 'next';
// Next.js publishes this ESM-compatible entry; Rslint cannot resolve its subpath.
// eslint-disable-next-line node/no-missing-import
import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';
import { packSkill, type SkilliOptions } from 'skilli';

export interface NextConfigContext {
  defaultConfig: NextConfig;
}

export type NextConfigFactory = (
  phase: string,
  context: NextConfigContext,
) => NextConfig | Promise<NextConfig>;

export type NextConfigInput =
  NextConfig | Promise<NextConfig> | NextConfigFactory;

export type SkilliNextConfig = (
  phase: string,
  context: NextConfigContext,
) => Promise<NextConfig>;

/** Create the archive in public before Next.js scans or exports public assets. */
export function withSkilli(
  options: SkilliOptions,
): (nextConfig?: NextConfigInput) => SkilliNextConfig {
  const root = resolve(options.root ?? process.cwd());

  return (nextConfig = {}) =>
    async (phase, context) => {
      const config = await (typeof nextConfig === 'function'
        ? nextConfig(phase, context)
        : nextConfig);

      if (phase === PHASE_PRODUCTION_BUILD) {
        await packSkill({
          ...options,
          root,
          filename: options.filename ?? 'downloads/skill-installer.tgz',
          outDir: join(root, 'public'),
        });
      }

      return config;
    };
}

export default withSkilli;
