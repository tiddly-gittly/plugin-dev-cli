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
}

/**
 * Create a WebSocket server in `noServer` mode so it can share the same port
 * as the TiddlyWiki HTTP server.  This eliminates the need to forward a
 * second port when working over SSH / VS Code remote tunnels.
 */
export const createNotifyServer = async (): Promise<NotifyServer> => {
  const server = new WebSocketServer({ noServer: true });

  let connectionCount = 0;

  server.on('connection', ws => {
    connectionCount++;
    const clientId = connectionCount;
    // eslint-disable-next-line no-console
    console.log(
      `[Modern.TiddlyDev] [ws] Client #${clientId} connected (total: ${server.clients.size})`,
    );
    refreshHeartBeat(ws);
    ws.ping();
    ws.on('pong', () => refreshHeartBeat(ws));
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
  });

  const onUpgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    // Only handle the /__dev_ws path so we don't interfere with other
    // upgrade requests (e.g. TiddlyWeb sync).
    if (request.url === '/__dev_ws') {
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

  return { server, attachToHttpServer, closeAllClients, notifyRefresh };
};
