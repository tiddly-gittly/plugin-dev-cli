import { getPort } from 'get-port-please';
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

export const createNotifyServer = async () => {
  const port = await getPort({ port: 8081 });
  const server = new WebSocketServer({ port });

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

  const notifyRefresh = () => {
    server.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('refresh');
      }
    });
  };

  return { server, port, notifyRefresh };
};
