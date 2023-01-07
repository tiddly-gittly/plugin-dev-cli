import { defineConfig } from '@modern-js/module-tools';

// https://modernjs.dev/docs/apis/module/config
export default defineConfig({
  output: {
    buildConfig: [
      {
        buildType: 'bundleless',
        format: 'cjs',
        target: 'es6',
        outputPath: './js',
      },
      {
        buildType: 'bundle',
        enableDts: true,
        dtsOnly: true,
        outputPath: '.',
      },
    ],
    copy: [{ from: './src/devweb-listener.js', to: '' }],
  },
});
