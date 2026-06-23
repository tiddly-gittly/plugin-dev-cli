export interface RestartableServer {
  once: (event: string, listener: (...args: unknown[]) => void) => void;
  close: () => void;
  /** Forcibly destroy all open TCP sockets. Available on Node >= 18.2. */
  closeAllConnections?: () => void;
}

export interface CloseServerForRestartOptions {
  /** Terminate WebSocket (upgraded) connections after they are detached. */
  closeWsClients: () => void;
  /** Called once the http.Server `'close'` event fires. */
  onClosed: () => void;
}

/**
 * Close an HTTP server — along with every lingering connection — so that a
 * replacement server can bind to the same port **immediately**.
 *
 * ### Why this matters
 *
 * `http.Server.close()` only stops accepting **new** connections. It waits
 * for every existing connection to drain (end) before emitting `'close'`.
 * With open browser tabs (keep‑alive HTTP/1.1, polling sync, etc.) those
 * connections may live forever, which means:
 *
 * - The `'close'` event never fires ⇒ the replacement server never starts.
 * - Meanwhile the old server refuses new requests (already half‑closed).
 *
 * Browsers then see *“Network Error – connection to the server has been
 * lost”*, exactly as reported in <https://git.io/dev-cli#0.5.11>.
 *
 * This helper destroys every underlying TCP socket so `'close'` fires
 * promptly, and additionally terminates WebSocket‑upgraded clients (which
 * are **not** tracked by `http.Server` and must be closed separately).
 */
export const closeServerForRestart = (
  server: RestartableServer,
  options: CloseServerForRestartOptions,
): void => {
  const { closeWsClients, onClosed } = options;
  // 1. Terminate WebSocket clients first — upgraded connections are not
  //    tracked by http.Server, so closeAllConnections() will not reach them.
  closeWsClients();
  // 2. Register the callback before initiating the shutdown.
  server.once('close', onClosed);
  // 3. Stop accepting new connections.
  server.close();
  // 4. Forcibly destroy every remaining HTTP/TCP socket so the 'close' event
  //    fires now instead of waiting for browser tabs to be closed. (Node ≥ 18.2)
  server.closeAllConnections?.();
};
