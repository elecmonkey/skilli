import { defineConfig } from 'vite';
import skilli from '@skilli/plugin-vite';

export default defineConfig({
  plugins: [
    skilli({
      skillDir: './skills/vite-greeter',
      cli: { entry: './src/cli.ts' },
      filename: 'downloads/vite-greeter-installer.tgz',
    }),
  ],
});
