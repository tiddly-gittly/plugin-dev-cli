#!/usr/bin/env node
import { init } from './init';
import { runDev } from './dev';
import { runTest } from './test';
import { createPlugin } from './new';
import { build, buildLibrary } from './build';
import { publishOnlineHTML, publishOfflineHTML } from './publish';
import { createProgram } from './program';

export const program = createProgram({
  init: async (project, repo, npm) => init(project, repo, npm),
  runDev: async (wiki, src, configs) => runDev(wiki, src, configs),
  runTest: async (wiki, src, exclude) => runTest(wiki, src, exclude),
  createPlugin: async src => createPlugin(src),
  build: async (output, excludeFilter, srcPath) =>
    build(output, excludeFilter, srcPath),
  buildLibrary: async (output, excludeFilter, srcPath, wikiPath) =>
    buildLibrary(output, excludeFilter, srcPath, wikiPath),
  publishOnlineHTML: async (
    wikiPath,
    dist,
    htmlName,
    excludeFilter,
    library,
    srcPath,
    excludePlugin,
  ) =>
    publishOnlineHTML(
      wikiPath,
      dist,
      htmlName,
      excludeFilter,
      library,
      srcPath,
      excludePlugin,
    ),
  publishOfflineHTML: async (
    wikiPath,
    dist,
    htmlName,
    excludeFilter,
    library,
    srcPath,
    excludePlugin,
  ) =>
    publishOfflineHTML(
      wikiPath,
      dist,
      htmlName,
      excludeFilter,
      library,
      srcPath,
      excludePlugin,
    ),
});

if (require.main === module) {
  program.parse();
}

export default program;
