import { Command } from 'commander';

export interface ProgramActions {
  init: (project: string, repo: string, npm?: string) => Promise<void>;
  runDev: (
    wiki: string,
    src: string,
    configs: {
      writeWiki?: boolean;
      excludeFilter?: string;
      lan?: boolean;
    },
  ) => Promise<void>;
  runTest: (wiki: string, src: string, exclude?: string) => Promise<void>;
  createPlugin: (src: string) => Promise<void>;
  build: (
    output?: string,
    excludeFilter?: string,
    srcPath?: string,
  ) => Promise<unknown>;
  buildLibrary: (
    output: string,
    excludeFilter?: string,
    srcPath?: string,
    wikiPath?: string,
  ) => Promise<unknown>;
  publishOnlineHTML: (
    wikiPath?: string,
    dist?: string,
    htmlName?: string,
    excludeFilter?: string,
    library?: boolean,
    srcPath?: string,
    excludePlugin?: string,
  ) => Promise<void>;
  publishOfflineHTML: (
    wikiPath?: string,
    dist?: string,
    htmlName?: string,
    excludeFilter?: string,
    library?: boolean,
    srcPath?: string,
    excludePlugin?: string,
  ) => Promise<void>;
}

export const createProgram = (actions: ProgramActions) => {
  const program = new Command();

  program
    .name('tiddlywiki-plugin-dev')
    .description(
      'Tiddlywiki plugin development tool, working with https://github.com/tiddly-gittly/Modern.TiddlyDev',
    );
  program
    .command('dev')
    .description(
      'Start a TiddlyWiki server with your plugin(s) for test. It will always watch the file changes in the plugin folder(s) and wiki folder, then refresh the browser page automatically.',
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
        await actions.runDev(wiki, src, {
          writeWiki,
          excludeFilter: exclude,
          lan,
        });
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
        await actions.runTest(wiki, src, exclude);
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
          await actions.buildLibrary(output, exclude, src, wiki);
        } else {
          await actions.build(output, exclude, src);
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
      await actions.createPlugin(src);
    });
  program
    .command('init')
    .description('Create a Modern.TiddlyDev project')
    .argument('<project>', 'Direction name of project')
    .option('--repo <github-url>', 'Magic for China mainland user', undefined)
    .option('--npm <npm-url>', 'Magic for China mainland user', undefined)
    .action(
      async (
        project: string,
        { repo, npm }: { repo?: string; npm?: string },
      ) => {
        await actions.init(
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
          await actions.publishOfflineHTML(
            wiki,
            dist,
            html,
            exclude,
            library,
            src,
            excludePlugin,
          );
        } else {
          await actions.publishOnlineHTML(
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

  return program;
};
