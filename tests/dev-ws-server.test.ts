import { WebSocket } from 'ws';
import { createNotifyServer } from '@/dev-ws-server';

describe('createNotifyServer', () => {
  test('broadcasts refresh to connected clients', async () => {
    const { server, port, notifyRefresh } = await createNotifyServer();

    try {
      await new Promise<void>((resolve, reject) => {
        const client = new WebSocket(`ws://127.0.0.1:${port}`);

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
            client.close();
            resolve();
          }
        });

        client.on('error', error => {
          clearTimeout(timer);
          reject(error);
        });
      });
    } finally {
      server.close();
    }
  });
});
