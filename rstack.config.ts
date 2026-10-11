import { define } from 'rstack';

define.lint(({ js, ts, rstestPlugin, nodePlugin, promisePlugin }) => [
  js.configs.recommended,
  ts.configs.strictTypeChecked,
  nodePlugin.configs.recommendedModule,
  promisePlugin.configs.recommended,
  {
    ...rstestPlugin.configs.recommended,
    files: ['packages/**/*.test.ts'],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
]);

define.fmt({
  sortPackageJson: true,
  singleQuote: true,
});
