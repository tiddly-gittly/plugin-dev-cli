import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';

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

export interface NotifyServer {
  server: WebSocketServer;
  /**
   * Attach this WebSocket server to a TiddlyWiki HTTP server via the
   * 'upgrade' event.  Returns a `detach` function that removes the
   * listener so the handler does not leak across server restarts.
   */
  attachToHttpServer: (httpServer: HttpServer) => () => void;
  /** Close all connected WebSocket clients so the HTTP server can shut down. */
  closeAllClients: () => void;
  /** Notify all connected browser clients to refresh. */
  notifyRefresh: () => void;
  /**
   * Set the current build generation. Clients that connect reporting an older
   * generation are told to refresh immediately, which makes auto-refresh robust
   * against the reconnect gap after a server restart.
   */
  setBuildGeneration: (generation: number) => void;
  /**
   * Register a callback that fires when any browser client starts or finishes
   * saving tiddlers to disk.  The dev server uses this to pause watch-triggered
   * restarts while the browser is writing files — otherwise the first saved
   * file would trigger a restart that kills the server mid-save, causing the
   * remaining files to fail with "Network Error".
   */
  onSaveBusyChange: (cb: (busy: boolean) => void) => () => void;
}

const DEV_WS_PATHNAME = '/__dev_ws';

/** Parse the build generation a client reports via the `gen` query parameter. */
const parseClientGeneration = (url?: string): number => {
  if (!url) {
    return 0;
  }
  try {
    const generation = Number(
      new URL(url, 'http://localhost').searchParams.get('gen'),
    );
    return Number.isFinite(generation) ? generation : 0;
  } catch {
    return 0;
  }
};

/** Parse the request pathname, ignoring any query string. */
const parseRequestPathname = (url?: string): string => {
  if (!url) {
    return '';
  }
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url;
  }
};

/**
 * Create a WebSocket server in `noServer` mode so it can share the same port
 * as the TiddlyWiki HTTP server.  This eliminates the need to forward a
 * second port when working over SSH / VS Code remote tunnels.
 */
export const createNotifyServer = async (): Promise<NotifyServer> => {
  const server = new WebSocketServer({ noServer: true });

  let connectionCount = 0;
  // The generation of the build the running wiki server was started with.
  // Clients reporting an older generation are stale and must reload.
  let currentGeneration = 0;
  // Whether any browser client is currently saving tiddlers to disk.
  let saveBusy = false;
  const saveBusyCallbacks: Array<(busy: boolean) => void> = [];

  server.on('connection', (ws, request: IncomingMessage) => {
    connectionCount++;
    const clientId = connectionCount;
    const clientGeneration = parseClientGeneration(request?.url);
    // eslint-disable-next-line no-console
    console.log(
      `[Modern.TiddlyDev] [ws] Client #${clientId} connected (total: ${server.clients.size})`,
    );
    refreshHeartBeat(ws);
    ws.ping();
    ws.on('pong', () => refreshHeartBeat(ws));

    ws.on('message', data => {
      const msg = String(data);
      if (msg === 'save-start') {
        if (!saveBusy) {
          saveBusy = true;
          saveBusyCallbacks.forEach(cb => cb(true));
        }
        return;
      }
      if (msg === 'save-end') {
        if (saveBusy) {
          saveBusy = false;
          saveBusyCallbacks.forEach(cb => cb(false));
        }
        return;
      }
    });

    ws.on('close', () => {
      if ((ws as any).heartBeatInterval) {
        clearInterval((ws as any).heartBeatInterval);
      }
      // server.clients may already be cleared if the server is shutting down.
      const remaining = server.clients?.size ?? 0;
      // eslint-disable-next-line no-console
      console.log(
        `[Modern.TiddlyDev] [ws] Client #${clientId} disconnected (total: ${remaining})`,
      );
    });

    // A client that reconnects after a restart reports the generation of the
    // page it is currently showing. If that page predates the current build,
    // tell it to reload now — this works regardless of how long the reconnect
    // took, so the browser never gets stuck on the previous (now-dead) server.
    if (
      currentGeneration > 0 &&
      clientGeneration < currentGeneration &&
      ws.readyState === WebSocket.OPEN
    ) {
      // eslint-disable-next-line no-console
      console.log(
        `[Modern.TiddlyDev] [refresh] Client #${clientId} is from build ${clientGeneration} (current ${currentGeneration}) — telling it to refresh`,
      );
      ws.send('refresh');
    }
  });

  const onUpgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    // Only handle the /__dev_ws path so we don't interfere with other
    // upgrade requests (e.g. TiddlyWeb sync). The pathname is compared on its
    // own so the `?gen=` query parameter does not break matching.
    if (parseRequestPathname(request.url) === DEV_WS_PATHNAME) {
      server.handleUpgrade(request, socket, head, ws => {
        server.emit('connection', ws, request);
      });
    }
    // For all other URLs we intentionally do nothing — other upgrade
    // listeners registered on the same HTTP server will get a chance to
    // handle them.
  };

  const attachToHttpServer = (httpServer: HttpServer) => {
    httpServer.on('upgrade', onUpgrade);
    return () => {
      httpServer.removeListener('upgrade', onUpgrade);
    };
  };

  const notifyRefresh = () => {
    const count = server.clients.size;
    if (count === 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[Modern.TiddlyDev] [refresh] No clients connected — skipping browser notification`,
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `[Modern.TiddlyDev] [refresh] Notifying ${count} client(s) to refresh`,
      );
      server.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('refresh');
        }
      });
    }
  };

  /** Terminate all WebSocket clients so the underlying HTTP server can close. */
  const closeAllClients = () => {
    for (const ws of server.clients) {
      ws.terminate();
    }
  };

  const setBuildGeneration = (generation: number) => {
    if (Number.isFinite(generation)) {
      currentGeneration = generation;
    }
  };

  return {
    server,
    attachToHttpServer,
    closeAllClients,
    notifyRefresh,
    setBuildGeneration,
    onSaveBusyChange: (cb) => {
      saveBusyCallbacks.push(cb);
      return () => {
        const i = saveBusyCallbacks.indexOf(cb);
        if (i !== -1) saveBusyCallbacks.splice(i, 1);
      };
    },
  };
};
