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
        // Node built-in modules — suppress "could not be resolved" warnings.
        externals: [
          'fs',
          'path',
          'os',
          'child_process',
          'url',
          'util',
          'events',
          'stream',
          'http',
          'https',
          'net',
          'crypto',
          'readline',
        ],
      },
      {
        buildType: 'bundle',
        enableDts: true,
        dtsOnly: true,
        target: 'esnext',
        outputPath: '.',
      },
    ],
    copy: [{ from: './src/devweb-listener.js', to: '' }],
  },
});
