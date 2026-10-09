import { define } from 'rstack';

define.lint(({ js, ts, rstestPlugin, nodePlugin }) => [
  js.configs.recommended,
  ts.configs.strictTypeChecked,
  nodePlugin.configs.recommendedModule,
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
]);

define.fmt({
  sortPackageJson: true,
  singleQuote: true,
});
