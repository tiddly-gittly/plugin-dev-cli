import http from 'http';
import net from 'net';
import { closeServerForRestart } from '@/dev-server-close';

/** Wait up to `timeoutMs` for the given server to emit 'close'. */
const waitForClose = (server: http.Server, timeoutMs = 2000) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('server did not close within timeout')),
      timeoutMs,
    );
    server.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });

describe('closeServerForRestart', () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    server = http.createServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>(resolve =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  afterEach(async () => {
    // clean up in case the test left the server open
    server.closeAllConnections?.();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  test('closeServerForRestart forces close even with an open keep-alive socket', async () => {
    const closeWsClients = jest.fn();

    // Open a keep-alive connection so plain .close() would hang.
    const socket = net.createConnection(port, '127.0.0.1');
    await new Promise<void>(resolve => socket.once('connect', resolve));

    let closed = false;
    closeServerForRestart(server, {
      closeWsClients,
      onClosed: () => {
        closed = true;
      },
    });

    // Must call closeWsClients first
    expect(closeWsClients).toHaveBeenCalled();

    // onClosed should fire promptly (closeAllConnections destroys all sockets)
    await new Promise<void>(resolve => {
      if (closed) {
        resolve();
        return;
      }
      const check = setInterval(() => {
        if (closed) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });

    expect(closed).toBe(true);
    socket.destroy();
  });

  test('closeServerForRestart works without closeAllConnections (Node < 18.2 compat)', async () => {
    // Simulate older Node without closeAllConnections
    const original = server.closeAllConnections;
    delete (server as unknown as Record<string, unknown>).closeAllConnections;

    const closeWsClients = jest.fn();

    const socket = net.createConnection(port, '127.0.0.1');
    await new Promise<void>(resolve => socket.once('connect', resolve));

    let closed = false;
    closeServerForRestart(server, {
      closeWsClients,
      onClosed: () => {
        closed = true;
      },
    });

    expect(closeWsClients).toHaveBeenCalled();

    // Without closeAllConnections, the socket must be destroyed for close
    socket.destroy();
    await waitForClose(server, 2000);

    expect(closed).toBe(true);

    // Restore
    (server as unknown as Record<string, unknown>).closeAllConnections = original;
  });
});
