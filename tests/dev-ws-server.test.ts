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

  test('stale client with older generation gets refresh on connect', async () => {
    const { server, attachToHttpServer, setBuildGeneration } =
      await createNotifyServer();

    // Simulate that the server has been restarted and is now serving build
    // generation 5. A client that held open a tab from generation 2 reconnects
    // and should be told to refresh immediately.
    setBuildGeneration(5);

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
          `ws://127.0.0.1:${port}/__dev_ws?gen=2`,
        );

        const timer = setTimeout(() => {
          client.terminate();
          reject(
            new Error(
              'timeout waiting for refresh on stale client reconnect',
            ),
          );
        }, 5000);

        client.on('message', data => {
          if (String(data) === 'refresh') {
            clearTimeout(timer);
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
      detach();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
  });

  test('current-generation client does NOT get refresh on connect', async () => {
    const { server, attachToHttpServer, setBuildGeneration } =
      await createNotifyServer();

    // Both the server and the client are on the same generation.
    setBuildGeneration(3);

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
      const result = await new Promise<'timeout' | 'refresh'>(
        resolve => {
          const client = new WebSocket(
            `ws://127.0.0.1:${port}/__dev_ws?gen=3`,
          );

          client.on('open', () => {
            // If no refresh arrives within 500ms, resolve as timeout (correct).
            setTimeout(() => {
              client.terminate();
              resolve('timeout');
            }, 500);
          });

          client.on('message', data => {
            if (String(data) === 'refresh') {
              client.terminate();
              resolve('refresh');
            }
          });
        },
      );

      // The client should NOT receive a refresh because its generation
      // matches the server.
      expect(result).toBe('timeout');
    } finally {
      detach();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
  });

  test('notifies onSaveBusyChange when client sends save-start / save-end', async () => {
    const { server, attachToHttpServer, onSaveBusyChange } =
      await createNotifyServer();

    const busyLog: boolean[] = [];
    const detachSave = onSaveBusyChange(busy => busyLog.push(busy));

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
          reject(new Error('timeout'));
        }, 5000);

        client.on('open', () => {
          client.send('save-start');
          setTimeout(() => {
            client.send('save-end');
            setTimeout(() => {
              clearTimeout(timer);
              client.once('close', () => resolve());
              client.close();
            }, 100);
          }, 100);
        });

        client.on('error', error => {
          clearTimeout(timer);
          reject(error);
        });
      });

      expect(busyLog).toEqual([true, false]);
    } finally {
      detachSave();
      detach();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
  });

  test('onSaveBusyChange detach stops receiving updates', async () => {
    const { server, attachToHttpServer, onSaveBusyChange } =
      await createNotifyServer();

    const busyLog: boolean[] = [];
    const detachSave = onSaveBusyChange(busy => busyLog.push(busy));
    detachSave();

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
          reject(new Error('timeout'));
        }, 5000);

        client.on('open', () => {
          client.send('save-start');
          setTimeout(() => {
            client.send('save-end');
            setTimeout(() => {
              clearTimeout(timer);
              client.once('close', () => resolve());
              client.close();
            }, 100);
          }, 100);
        });

        client.on('error', error => {
          clearTimeout(timer);
          reject(error);
        });
      });

      expect(busyLog).toEqual([]);
    } finally {
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
