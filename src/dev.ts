import fs from 'fs';
import path from 'path';
import tw from 'tiddlywiki';
import chokidar from 'chokidar';
import { Server } from 'tw5-typed';
import { getPort } from 'get-port-please';
import { WebSocketServer, WebSocket } from 'ws';

import { rebuild } from './packup';
import { tiddlywiki } from './utils';

// WebSocket with TiddlyWiki on broswer
const runServer = async () => {
  const port = await getPort({ port: 8081 });
  const server = new WebSocketServer({ port });
  const refreshHeartBeat = (ws: any) => {
    ws.isAlive = true;
    if (ws.heartBeatInterval) {
      clearInterval(ws.heartBeatInterval);
    }
    // eslint-disable-next-line consistent-return
    ws.heartBeatInterval = setInterval(() => {
      if (ws.isAlive === false) {
        clearInterval(ws.heartBeatInterval);
        delete ws.heartBeatInterval;
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    }, 5_000);
  };
  server.on('connection', ws => {
    refreshHeartBeat(ws);
    ws.ping();
    ws.on('pong', () => refreshHeartBeat(ws));
    ws.on('close', () => {
      if ((ws as any).heartBeatInterval) {
        clearInterval((ws as any).heartBeatInterval);
      }
    });
  });
  server.on('close', () => {
    server.clients.forEach(ws => {
      if ((ws as any).heartBeatInterval) {
        clearInterval((ws as any).heartBeatInterval);
      }
      ws.send('bye');
    });
  });
  return { server, port };
};

// Run refresh server
export const runDev = async (wiki: string) => {
  const { server, port } = await runServer();
  const devWebListnerScript = fs
    .readFileSync(path.resolve(__dirname, 'src/devweb-listener.js'), 'utf-8')
    .replace('$$$$port$$$$', `${port}`);

  // Watch source files change
  const $tw1 = tiddlywiki([], wiki);
  let twServer: Server;
  const watcher = chokidar.watch('src', {
    ignoreInitial: true,
    followSymlinks: true,
    ignored: $tw1.boot.excludeRegExp,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  });
  let updateFiles: string[] | undefined;
  const refresh = async (path: string) => {
    // 因为 build 是异步的，这里给 refresh 加一个资源锁，否则会出现奇怪的问题
    if (updateFiles !== undefined) {
      updateFiles.push(path);
      return;
    } else {
      updateFiles = [path];
    }
    while (updateFiles?.length) {
      let resolve: (value: void | PromiseLike<void>) => void;
      const wait = new Promise<void>(_resolve => (resolve = _resolve));
      const tmp = updateFiles;
      updateFiles = [];
      $tw1.wiki.deleteTiddler('$:/Modern.TiddlyDev/devWebsocket/listener');
      const plugins = await rebuild($tw1, 'src', tmp, true);
      const $tw = tw.TiddlyWiki();
      $tw.preloadTiddler({
        title: '$:/Modern.TiddlyDev/devWebsocket/listener',
        text: devWebListnerScript,
        type: 'application/javascript',
        'module-type': 'startup',
      });
      $tw.preloadTiddlerArray(plugins);
      $tw.hooks.addHook(
        'th-server-command-post-start',
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        (_listenCommand, newTwServer) => {
          newTwServer.on('listening', () => resolve());
          twServer = newTwServer;
        },
      );
      const serve = async () => {
        const port = await getPort({ port: 8080 });
        $tw.boot.argv = [wiki, '--listen', `port=${port}`];
        $tw.boot.boot();
      };
      if (twServer) {
        twServer.on('close', serve);
        twServer.close();
      } else {
        serve();
      }
      await wait;
    }
    server.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('refresh');
      }
    });
    updateFiles = undefined;
  };
  watcher.on('ready', refresh);
  watcher.on('add', refresh);
  watcher.on('change', refresh);
};
