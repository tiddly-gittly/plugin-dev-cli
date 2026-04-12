import { defineLegacyConfig } from '@modern-js/module-tools';

// https://modernjs.dev/docs/apis/module/config
export default defineLegacyConfig({
  output: {
    buildConfig: [
      {
        buildType: 'bundleless',
        format: 'esm',
        target: 'esnext',
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
