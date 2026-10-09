import { parseArgs } from 'node:util';
import { packSkill } from './index.js';

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      entry: { type: 'string' },
      'cli-filename': { type: 'string' },
      'out-dir': { type: 'string' },
      filename: { type: 'string' },
      version: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'skilli <skill-directory> [--entry cli.ts] [--cli-filename cli.mjs] [--out-dir dist] [--filename installer.tgz] [--version 0.1.0]',
    );
  } else {
    if (positionals.length !== 1) {
      throw new Error('Pass one skill directory. Use --help for usage.');
    }
    if (values['cli-filename'] && !values.entry) {
      throw new Error('--cli-filename requires --entry.');
    }
    console.log(
      JSON.stringify(
        await packSkill({
          skillDir: positionals[0],
          outDir: values['out-dir'],
          filename: values.filename,
          version: values.version,
          cli: values.entry
            ? {
                entry: values.entry,
                filename: values['cli-filename'],
              }
            : undefined,
        }),
      ),
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
