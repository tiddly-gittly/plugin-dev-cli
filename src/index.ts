#!/usr/bin/env node
import { program } from 'commander';
import { runDev } from './dev';
import { build, buildLibrary } from './build';

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
  .action(async ({ library }: { library: boolean }) => {
    if (library) {
      await buildLibrary();
    } else {
      await build();
    }
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  });
program.parse();
