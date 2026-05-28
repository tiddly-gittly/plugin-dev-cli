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
      const batchStart = Date.now();
      const fileList = changedPaths.filter(Boolean);
      // eslint-disable-next-line no-console
      console.log(
        `\n[Modern.TiddlyDev] [refresh] Refresh started - ${fileList.length} file(s) changed`,
      );
      if (fileList.length > 0) {
        fileList.forEach(f => {
          // eslint-disable-next-line no-console
          console.log(`    - ${f}`);
        });
      }

      const plugins = await rebuildPlugins(changedPaths);
      const rebuildMs = Date.now() - batchStart;
      // eslint-disable-next-line no-console
      console.log(
        `[Modern.TiddlyDev] [refresh] Plugins rebuilt in ${rebuildMs}ms`,
      );

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
      if (!writeWiki) {
        wiki.preloadTiddler({
          title: '$:/config/SyncFilter',
          text: '',
        });
      }

      wiki.preloadTiddlerArray(plugins);

      if (writeWiki) {
        wiki.appendExtraPlugins(devWritePlugins);
      }

      const started = await startServer(wiki, changedPaths);
      if (started) {
        const totalMs = Date.now() - batchStart;
        // eslint-disable-next-line no-console
        console.log(
          `[Modern.TiddlyDev] [refresh] Server restarted in ${totalMs}ms total`,
        );
        notifyRefresh();
      } else {
        // eslint-disable-next-line no-console
        console.error(
          `[Modern.TiddlyDev] [refresh] Server failed to start after ${Date.now() - batchStart}ms`,
        );
      }
    },
    onError: reportError,
  });
