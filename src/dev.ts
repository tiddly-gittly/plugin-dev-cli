import fs from 'fs';
import path from 'path';
import tw from 'tiddlywiki';
import chokidar from 'chokidar';
import { Server } from 'tw5-typed';

import { rebuild } from './packup';
import { createDevRefreshHandler, DevRefreshWiki } from './dev-refresh';
import { createNotifyServer } from './dev-ws-server';
import { buildWatchIgnored } from './dev-ignored';
import { resolveWikiListenPort } from './dev-port';
import { tiddlywiki } from './utils';

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
  const { port, notifyRefresh } = await createNotifyServer();
  const watchRoots = Array.from(
    new Set([src, wiki].map(target => path.resolve(target))),
  );
  const devWebListnerScript = fs
    .readFileSync(path.resolve(__dirname, 'src/devweb-listener.js'), 'utf-8')
    .replace('$$$$port$$$$', `${port}`);

  // Watch source files and wiki files change
  const $tw1 = tiddlywiki([], wiki);
  let twServer: Server;

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

    console.error(
      changed.length > 0
        ? `Compilation failed for: ${changed.join(', ')}`
        : 'Compilation failed during initial build.',
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
        newTwServer.once('listening', () => finish(true));
        twServer = newTwServer;
      },
    );
    const serve = async () => {
      const port = await resolveWikiListenPort(lan);
      $tw.boot.argv = [wiki, '--listen', `port=${port}`];
      if (lan) {
        $tw.boot.argv.push('host=0.0.0.0');
      }
      $tw.boot.boot();
    };
    const startServer = () => {
      serve().catch(error => {
        reportRefreshError(error, changedPaths);
        finish(false);
      });
    };
    if (twServer) {
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
