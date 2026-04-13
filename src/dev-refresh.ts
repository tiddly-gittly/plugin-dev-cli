import { createQueuedWatchHandler } from './dev-watch';

export const devWritePlugins = [
  'plugins/tiddlywiki/filesystem',
  'plugins/tiddlywiki/tiddlyweb',
];

export interface DevRefreshWiki {
  runtime: unknown;
  preloadTiddler: (tiddler: Record<string, unknown>) => void;
  preloadTiddlerArray: (tiddlers: Record<string, unknown>[]) => void;
  appendExtraPlugins: (plugins: string[]) => void;
}

export interface DevRefreshHandlerOptions {
  listenerScript: string;
  writeWiki?: boolean;
  rebuildPlugins: (
    changedPaths: string[],
  ) => Promise<Record<string, unknown>[]>;
  createWiki: () => DevRefreshWiki;
  startServer: (
    wiki: DevRefreshWiki,
    changedPaths: string[],
  ) => Promise<boolean>;
  notifyRefresh: () => void;
  reportError: (error: unknown, changedPaths: string[]) => void;
}

export const createDevRefreshHandler = ({
  listenerScript,
  writeWiki,
  rebuildPlugins,
  createWiki,
  startServer,
  notifyRefresh,
  reportError,
}: DevRefreshHandlerOptions) =>
  createQueuedWatchHandler({
    runBatch: async changedPaths => {
      const plugins = await rebuildPlugins(changedPaths);
      const wiki = createWiki();

      wiki.preloadTiddler({
        title: '$:/Modern.TiddlyDev/devWebsocket/listener',
        text: listenerScript,
        type: 'application/javascript',
        'module-type': 'startup',
      });

      // When not writing back to wiki files, override the sync filter to match
      // zero tiddlers. This prevents the server-side filesystem syncadaptor from
      // dispatching save/delete tasks even when tiddlywiki/filesystem is declared
      // in the project's tiddlywiki.info (e.g. basic client-server edition).
      // [all[]limit[0]] is the simplest zero-match filter: take 0 from all tiddlers.
      // It is ~3x faster than [all[]]-[all[]] and avoids two full-set operations.
      if (!writeWiki) {
        wiki.preloadTiddler({
          title: '$:/config/SyncFilter',
          text: '[all[]limit[0]]',
        });
      }

      wiki.preloadTiddlerArray(plugins);

      if (writeWiki) {
        wiki.appendExtraPlugins(devWritePlugins);
      }

      const started = await startServer(wiki, changedPaths);
      if (started) {
        notifyRefresh();
      }
    },
    onError: reportError,
  });
