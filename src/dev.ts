import path from 'path';
import tw from 'tiddlywiki';
import chokidar from 'chokidar';

import { rebuild } from './packup';
import { createDevRefreshHandler, DevRefreshWiki } from './dev-refresh';
import { createNotifyServer } from './dev-ws-server';
import { buildWatchIgnored } from './dev-ignored';
import { createWikiPortResolver } from './dev-port';
import { buildListenArgs } from './dev-listen-args';
import { renderDevWebListenerScript } from './devweb-listener-template';
import { tiddlywiki } from './utils';

type ClosableServer = {
  once: (event: string, listener: (...args: unknown[]) => void) => void;
  close: () => void;
};

// Run refresh server
export const runDev = async (
  wiki: string,
  src: string,
  configs: {
    lan?: boolean;
    writeWiki?: boolean;
    excludeFilter?: string;
  },
) => {
  const { lan, writeWiki, excludeFilter } = configs;
  const { attachToHttpServer, closeAllClients, notifyRefresh } = await createNotifyServer();
  // Tracks the detach function for the currently active server's upgrade handler.
  let detachWs: (() => void) | undefined;
  const watchRoots = Array.from(
    new Set([src, wiki].map(target => path.resolve(target))),
  );
  // No longer need a separate WS port — the client connects to the same
  // host:port as the wiki page, so it works through SSH / VS Code tunnels.
  const devWebListnerScript = renderDevWebListenerScript();

  // Watch source files and wiki files change
  // Preload SyncFilter override for the scanner instance too, so the
  // filesystem syncadaptor doesn't dispatch save tasks during scanning.
  const scannerPreload = writeWiki
    ? []
    : [{ title: '$:/config/SyncFilter', text: '' }];
  const $tw1 = tiddlywiki(scannerPreload, wiki);
  let twServer: ClosableServer | undefined;
  const resolveStableWikiPort = createWikiPortResolver(lan);

  const watcher = chokidar.watch(watchRoots, {
    ignoreInitial: true,
    followSymlinks: true,
    ignored: buildWatchIgnored($tw1, src, wiki),
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  });
  const reportRefreshError = (error: unknown, changedPaths: string[]) => {
    const changed = changedPaths.filter(Boolean);
    const timestamp = new Date().toLocaleTimeString();

    console.error(
      changed.length > 0
        ? `[${timestamp}] [refresh] Compilation failed for: ${changed.join(', ')}`
        : `[${timestamp}] [refresh] Compilation failed during initial build.`,
    );
    console.error('Waiting for the next change to retry...');
    console.error(error);
  };
  const startWikiServer = async (
    wikiRuntime: DevRefreshWiki,
    changedPaths: string[],
  ) => {
    const $tw = wikiRuntime.runtime as ReturnType<typeof tw.TiddlyWiki>;
    let resolve: (started: boolean) => void;
    let settled = false;
    const finish = (started: boolean) => {
      if (!settled) {
        settled = true;
        resolve(started);
      }
    };
    const wait = new Promise<boolean>(_resolve => (resolve = _resolve));

    $tw.hooks.addHook(
      'th-server-command-post-start',
      (_listenCommand, newTwServer) => {
        const onServerError = (error: unknown) => {
          reportRefreshError(error, changedPaths);
          finish(false);
        };
        newTwServer.once('error', onServerError);
        newTwServer.once('listening', () => {
          // Detach the upgrade handler from the previous server (if any)
          // before attaching to the new one, so we never leak listeners.
          detachWs?.();
          detachWs = attachToHttpServer(newTwServer);
          finish(true);
        });
        twServer = newTwServer;
      },
    );
    const serve = async () => {
      const port = await resolveStableWikiPort();
      $tw.boot.argv = buildListenArgs({
        wikiPath: wiki,
        port,
        lan,
        writeWiki,
      });
      $tw.boot.boot();
    };
    const startServer = () => {
      serve().catch(error => {
        reportRefreshError(error, changedPaths);
        finish(false);
      });
    };
    if (twServer) {
      // Close all WebSocket clients first — upgraded connections are not
      // tracked by http.Server so closeAllConnections() won't reach them.
      closeAllClients();
      twServer.once('close', startServer);
      twServer.close();
    } else {
      startServer();
    }

    return wait;
  };
  const refresh = createDevRefreshHandler({
    listenerScript: devWebListnerScript,
    writeWiki,
    rebuildPlugins: async changedPaths => {
      $tw1.wiki.deleteTiddler('$:/Modern.TiddlyDev/devWebsocket/listener');
      return rebuild($tw1, src, changedPaths, true, excludeFilter);
    },
    createWiki: () => {
      const $tw = tw.TiddlyWiki();
      return {
        runtime: $tw,
        preloadTiddler: tiddler => $tw.preloadTiddler(tiddler),
        preloadTiddlerArray: tiddlers => $tw.preloadTiddlerArray(tiddlers),
        appendExtraPlugins: plugins => {
          $tw.boot.extraPlugins = [
            ...($tw.boot.extraPlugins ?? []),
            ...plugins,
          ];
        },
      };
    },
    startServer: startWikiServer,
    notifyRefresh,
    reportError: reportRefreshError,
  });
  const triggerRefresh = (changedPath?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    if (changedPath) {
      // eslint-disable-next-line no-console
      console.log(
        `[${timestamp}] [watch] File changed: ${changedPath}`,
      );
    }
    refresh(changedPath).catch(error => reportRefreshError(error, []));
  };

  watcher.on('error', error => reportRefreshError(error, []));
  watcher.on('ready', () => triggerRefresh());
  watcher.on('add', triggerRefresh);
  watcher.on('addDir', triggerRefresh);
  watcher.on('change', triggerRefresh);
  watcher.on('unlink', triggerRefresh);
  watcher.on('unlinkDir', triggerRefresh);
};
