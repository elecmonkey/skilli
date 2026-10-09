import { define } from 'rstack';
import { resolve } from 'node:path';

define.lib({
  lib: [
    {
      dts: {
        isolated: true,
      },
    },
    {
      source: {
        entry: {
          cli: './src/cli.ts',
        },
      },
      banner: {
        js: '#!/usr/bin/env node',
      },
    },
    {
      source: {
        entry: {
          install: resolve(import.meta.dirname, '../installer/src/index.ts'),
        },
      },
      banner: {
        js: '#!/usr/bin/env node',
      },
      output: {
        autoExternal: false,
        minify: true,
        distPath: {
          root: 'dist/assets',
        },
        filename: {
          js: '[name].mjs',
        },
      },
    },
  ],
});

define.test({
  testTimeout: 60000,
});
