import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from '@modern-js/module-tools';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const addRelativeJsExtensionPlugin = path.resolve(
  configDir,
  'scripts/babel-plugin-add-relative-js-extension.cjs',
);

// https://modernjs.dev/docs/apis/module/config
export default defineConfig({
  tools: {
    babel: {
      plugins: [addRelativeJsExtensionPlugin],
    },
  },
  output: {
    buildConfig: [
      {
        buildType: 'bundleless',
        format: 'esm',
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
