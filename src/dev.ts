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
import { closeServerForRestart } from './dev-server-close';
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
  const { attachToHttpServer, closeAllClients, notifyRefresh, setBuildGeneration, onSaveBusyChange } =
    await createNotifyServer();
  // Tracks the detach function for the currently active server's upgrade handler.
  let detachWs: (() => void) | undefined;
  const watchRoots = Array.from(
    new Set([src, wiki].map(target => path.resolve(target))),
  );
  // Monotonically increasing build counter so the WS server can tell whether
  // a reconnecting client is from an older page and must reload.
  let buildGeneration = 0;
  const nextGeneration = () => buildGeneration;
  // When a browser tab is saving tiddlers to disk (e.g. bulk-installing
  // plugins, editing in write-wiki mode), pause server restarts so the
  // save isn't interrupted mid-flight by a server shutdown.
  let saveBusy = false;
  // Paths that changed while the browser was saving.  Flushed when save ends.
  let deferredPaths: string[] | undefined;
  onSaveBusyChange(busy => {
    saveBusy = busy;
    if (busy) {
      // eslint-disable-next-line no-console
      console.log(
        '[Modern.TiddlyDev] [save] Browser is writing files — deferring server restarts',
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(
        '[Modern.TiddlyDev] [save] Browser write finished — flushing deferred changes',
      );
      const paths = deferredPaths;
      deferredPaths = undefined;
      if (paths && paths.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[Modern.TiddlyDev] [save] ${paths.length} file(s) changed during save`,
        );
        // Trigger one refresh for all deferred paths so the server picks up
        // any new/changed plugins that were written during the save burst.
        triggerRefresh();
      }
    }
  });

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
    generation: number,
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
          // Tell the WS server which generation this build is so it can
          // immediately tell stale re-connecting tabs to reload.
          setBuildGeneration(generation);
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
      // Use closeServerForRestart to forcibly destroy every lingering TCP
      // socket so the 'close' event fires immediately — even when browser
      // tabs still hold keep-alive connections (the root cause of the
      // "server doesn't restart until all tabs are closed" bug in 0.5.11).
      closeServerForRestart(twServer, {
        closeWsClients: closeAllClients,
        onClosed: startServer,
      });
    } else {
      startServer();
    }

    return wait;
  };
  const refresh = createDevRefreshHandler({
    renderListenerScript: renderDevWebListenerScript,
    nextGeneration,
    writeWiki,
    rebuildPlugins: async changedPaths => {
      $tw1.wiki.deleteTiddler('$:/Modern.TiddlyDev/devWebsocket/listener');
      const plugins = await rebuild($tw1, src, changedPaths, true, excludeFilter);
      // Advance the generation *after* the build succeeds so the new page
      // will be tagged with the next generation. On reconnect the WS server
      // compares the client's gen against `currentGeneration` and refreshes
      // any stale tabs.
      buildGeneration++;
      return plugins;
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
    // While the browser is saving files to disk, defer all chokidar events
    // so the server isn't restarted mid-save.
    if (saveBusy) {
      if (changedPath) {
        if (!deferredPaths) deferredPaths = [];
        deferredPaths.push(changedPath);
      }
      return;
    }

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
