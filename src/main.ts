#!/usr/bin/env node
import { program } from 'commander';
import { init } from './init';
import { runDev } from './dev';
import { createPlugin } from './new';
import { build, buildLibrary } from './build';
import { publishOnlineHTML, publishOfflineHTML } from './publish';

program
  .name('tiddlywiki-plugin-dev')
  .description(
    'Tiddlywiki plugin development tool, working with https://github.com/tiddly-gittly/Modern.TiddlyDev',
  );
program
  .command('dev')
  .description(
    'Start a TiddlyWiki server with your plugin(s) for test. It will always watch the file changes in the plugin folder(s) and refresh the browser page automatically.',
  )
  .action(async () => {
    await runDev();
  });
program
  .command('build')
  .description('Build plugins for Modern.TiddlyDev')
  .option('--library', 'whether to build plugin library files', false)
  .option('--output <output>', 'set output directory', 'dist')
  .action(async ({ library, output }: { library: boolean; output: string }) => {
    if (library) {
      await buildLibrary(output);
    } else {
      await build(output);
    }
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  });
program
  .command('new')
  .description('Create a new plugin')
  .action(async () => {
    await createPlugin();
  });
program
  .command('init')
  .description('Create a Modern.TiddlyDev project')
  .argument('<project>', 'Direction name of project')
  .action(async (project: string) => {
    await init(project);
  });
program
  .command('publish')
  .description('Publish wiki')
  .argument('[dist]', 'Destination folder to publish', 'dist')
  .option(
    '-e, --exclude <exclude-filter>',
    'Filter to exclude publishing tiddlers',
    '-[is[draft]]',
  )
  .option(
    '--offline',
    'Generate single wiki file, with an external core js file',
    false,
  )
  .option(
    '--html <html-file>',
    'File name of generated index html file',
    'index.html',
  )
  .option('--wiki <wiki-path>', 'Path of your wiki to publish', './wiki')
  .action(
    async (
      dist: string,
      {
        offline,
        excludeFilter,
        htmlFile,
        wikiPath,
      }: {
        offline: boolean;
        excludeFilter: string;
        htmlFile: string;
        wikiPath: string;
      },
    ) => {
      if (offline) {
        await publishOfflineHTML(wikiPath, dist, htmlFile, excludeFilter);
      } else {
        await publishOnlineHTML(wikiPath, dist, htmlFile, excludeFilter);
      }
      // eslint-disable-next-line no-process-exit
      process.exit(0);
    },
  );
program.parse();
