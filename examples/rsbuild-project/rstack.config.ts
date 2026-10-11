import { define } from 'rstack';
import { pluginSkilli } from '@skilli/plugin-rsbuild';

define.app({
  html: {
    template: './index.html',
  },
  plugins: [
    pluginSkilli({
      skillDir: './skills/rsbuild-greeter',
      cli: { entry: './src/cli.ts' },
      filename: 'downloads/rsbuild-greeter-installer.tgz',
    }),
  ],
});
