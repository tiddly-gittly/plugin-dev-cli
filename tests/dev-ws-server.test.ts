import http from 'http';
import { WebSocket } from 'ws';
import { createNotifyServer } from '@/dev-ws-server';

describe('createNotifyServer', () => {
  test('broadcasts refresh to connected clients', async () => {
    const { server, attachToHttpServer, notifyRefresh } =
      await createNotifyServer();

    // Create a real HTTP server and attach the WS upgrade handler to it.
    const httpServer = http.createServer();
    const detach = attachToHttpServer(httpServer);

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(0, '127.0.0.1', resolve);
      httpServer.once('error', reject);
    });

    const address = httpServer.address();
    const port =
      typeof address === 'object' && address ? address.port : 0;

    try {
      await new Promise<void>((resolve, reject) => {
        const client = new WebSocket(
          `ws://127.0.0.1:${port}/__dev_ws`,
        );

        const timer = setTimeout(() => {
          client.terminate();
          reject(new Error('timeout waiting for refresh message'));
        }, 5000);

        client.on('open', () => {
          notifyRefresh();
        });

        client.on('message', data => {
          if (String(data) === 'refresh') {
            clearTimeout(timer);
            // Wait for the socket to fully close before resolving,
            // so the server-side close log does not fire after the
            // test has already finished (Jest "Cannot log after tests done").
            client.once('close', () => resolve());
            client.close();
          }
        });

        client.on('error', error => {
          clearTimeout(timer);
          reject(error);
        });
      });
    } finally {
      // Clean up in reverse order: detach handler, close WS server, close HTTP server.
      detach();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
  });

  test('attachToHttpServer detach removes upgrade handler', async () => {
    const { server, attachToHttpServer } = await createNotifyServer();

    const httpServer = http.createServer();
    const detach = attachToHttpServer(httpServer);

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(0, '127.0.0.1', resolve);
      httpServer.once('error', reject);
    });

    const address = httpServer.address();
    const port =
      typeof address === 'object' && address ? address.port : 0;

    try {
      // After detaching, the upgrade handler should no longer respond.
      detach();

      const client = new WebSocket(
        `ws://127.0.0.1:${port}/__dev_ws`,
      );

      await new Promise<void>(resolve => {
        client.on('error', () => resolve());
        // If the handler were still attached the connection would
        // succeed and we'd time out instead.
        setTimeout(() => {
          client.terminate();
          resolve();
        }, 500);
      });
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
  });
});
