import { defineConfig } from '@modern-js/module-tools';

// https://modernjs.dev/docs/apis/module/config
export default defineConfig({
  output: {
    buildPreset: 'npm-library',
    buildConfig: {
      format: 'cjs',
    },
    copy: [{ from: './src/devweb-listener.js', to: '' }],
  },
});
