#!/usr/bin/env node
import { program } from 'commander';
import { init } from './init';
import { runDev } from './dev';
import { runTest } from './test';
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
  .option('--wiki <wiki-path>', 'Path of your wiki to publish', './wiki')
  .option('--src <src-path>', 'Root path of developing plugins', './src')
  .option(
    '--write-wiki',
    'Write back changes from browser to the wiki. (If without this, wiki is readonly)',
  )
  .option(
    '--lan',
    'Listen on 0.0.0.0, so it can be open on mobile phone on same lan wifi (If without this, wiki is on `127.0.0.1`, which can only open on the local machine)',
  )
  .option(
    '--exclude <exclude-filter>',
    'Filter to exclude publishing plugins. e.g. [prefix[$:/plugins/aaa/]]',
    undefined,
  )
  .action(
    async ({
      wiki,
      exclude,
      src,
      writeWiki,
      lan,
    }: {
      wiki: string;
      exclude?: string;
      src: string;
      writeWiki?: boolean;
      lan?: boolean;
    }) => {
      await runDev(wiki, src, { writeWiki, excludeFilter: exclude, lan });
    },
  );
program
  .command('test')
  .description('Run tests using Jasmine plugin. And works simillar to dev.')
  .option('--wiki <wiki-path>', 'Path of your wiki to publish', './wiki')
  .option('--src <src-path>', 'Root path of developing plugins', './src')
  .option(
    '--exclude <exclude-filter>',
    'Filter to exclude publishing plugins. e.g. [prefix[$:/plugins/aaa/]]',
    undefined,
  )
  .action(
    async ({
      wiki,
      exclude,
      src,
    }: {
      wiki: string;
      exclude?: string;
      src: string;
    }) => {
      await runTest(wiki, src, exclude);
    },
  );
program
  .command('build')
  .description('Build plugins for Modern.TiddlyDev')
  .option('--library', 'whether to build plugin library files', false)
  .option('--output <output>', 'set output directory', 'dist')
  .option('--wiki <wiki-path>', 'Path of your wiki to publish', './wiki')
  .option('--src <src-path>', 'Root path of developing plugins', './src')
  .option(
    '--exclude <exclude-filter>',
    'Filter to exclude publishing plugins. e.g. [prefix[$:/plugins/aaa/]]',
    undefined,
  )
  .action(
    async ({
      library,
      output,
      src,
      wiki,
      exclude,
    }: {
      library: boolean;
      output: string;
      src: string;
      wiki: string;
      exclude?: string;
    }) => {
      if (library) {
        await buildLibrary(output, exclude, src, wiki);
      } else {
        await build(output, exclude, src);
      }
      // eslint-disable-next-line no-process-exit
      process.exit(0);
    },
  );
program
  .command('new')
  .description('Create a new plugin')
  .option('--src <src-path>', 'Root path of developing plugins', './src')
  .action(async ({ src }: { src: string }) => {
    await createPlugin(src);
  });
program
  .command('init')
  .description('Create a Modern.TiddlyDev project')
  .argument('<project>', 'Direction name of project')
  .option('--repo <github-url>', 'Magic for China mainland user', undefined)
  .option('--npm <npm-url>', 'Magic for China mainland user', undefined)
  .action(
    async (project: string, { repo, npm }: { repo?: string; npm?: string }) => {
      await init(
        project,
        repo || 'https://github.com/tiddly-gittly/Modern.TiddlyDev.git',
        npm,
      );
    },
  );
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
    '--exclude-plugin <exclude-plugin-filter>',
    'Filter to exclude publishing plugins. e.g. [prefix[$:/plugins/aaa/]]',
    undefined,
  )
  .option('--offline', 'Generate single wiki file', false)
  .option('--src <src-path>', 'Root path of developing plugins', './src')
  .option(
    '--html <html-file>',
    'File name of generated index html file',
    'index.html',
  )
  .option('--no-library', 'Do not generate plugin library', true)
  .option('--wiki <wiki-path>', 'Path of your wiki to publish', './wiki')
  .action(
    async (
      dist: string,
      {
        offline,
        exclude,
        excludePlugin,
        library,
        html,
        wiki,
        src,
      }: {
        offline: boolean;
        exclude: string;
        excludePlugin?: string;
        library: boolean;
        html: string;
        wiki: string;
        src: string;
      },
    ) => {
      if (offline) {
        await publishOfflineHTML(
          wiki,
          dist,
          html,
          exclude,
          library,
          src,
          excludePlugin,
        );
      } else {
        await publishOnlineHTML(
          wiki,
          dist,
          html,
          exclude,
          library,
          src,
          excludePlugin,
        );
      }
      // eslint-disable-next-line no-process-exit
      process.exit(0);
    },
  );
program.parse();
