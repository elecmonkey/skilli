import { define } from 'rstack';

define.lint(
  ({ js, ts, rstestPlugin, nodePlugin, promisePlugin, importPlugin }) => [
    js.configs.recommended,
    ts.configs.strictTypeChecked,
    nodePlugin.configs.recommendedModule,
    promisePlugin.configs.recommended,
    importPlugin.configs.recommended,
    {
      ...rstestPlugin.configs.recommended,
      files: ['packages/**/*.test.ts'],
    },
    {
      languageOptions: {
        parserOptions: {
          project: false,
          projectService: true,
        },
      },
    },
  ],
);

define.fmt({
  sortPackageJson: true,
  singleQuote: true,
});
