(function () {
  // eslint-disable-next-line no-undef
  const moduleExports = exports;
  // Export name and synchronous status
  moduleExports.name = 'devweb-listner';
  moduleExports.platforms = ['browser'];
  moduleExports.after = ['load-modules'];
  moduleExports.synchronous = true;
  moduleExports.startup = function () {
    const WS =
      (typeof globalThis !== 'undefined' && globalThis.WebSocket) ||
      // eslint-disable-next-line no-undef
      (typeof window !== 'undefined' ? window.WebSocket : undefined);
    if (!WS) {
      console.error(
        '[Modern.TiddlyDev]',
        'Unsupported browser, need WebSocket support',
      );
      return;
    }

    // Connect to the same host:port as the wiki page via /__dev_ws path.
    // This means only one port needs to be forwarded through SSH / VS Code tunnels.
    // eslint-disable-next-line no-undef
    const protocol = document.location.protocol === 'https:' ? 'wss' : 'ws';
    // eslint-disable-next-line no-undef
    const url = protocol + '://' + document.location.host + '/__dev_ws';
    let reconnectDelay = 1000;
    const maxReconnectDelay = 10000;
    let disposed = false;

    function connect() {
      if (disposed) return;
      const socket = new WS(url);

      socket.onopen = function () {
        reconnectDelay = 1000;
        // eslint-disable-next-line no-console
        console.debug(
          '[Modern.TiddlyDev]',
          'Dev WebSocket connected - auto-refresh enabled.',
        );
      };

      socket.onmessage = function (event) {
        switch (event.data) {
          case 'bye': {
            socket.close();
            break;
          }
          case 'refresh': {
            disposed = true;
            socket.close();
            // eslint-disable-next-line no-undef
            document.location.reload();
            break;
          }
          default:
            break;
        }
      };

      socket.onclose = function () {
        if (disposed) return;
        // eslint-disable-next-line no-console
        console.warn(
          '[Modern.TiddlyDev]',
          'Dev WebSocket closed - reconnecting in ' +
            Math.round(reconnectDelay / 1000) +
            's...',
        );
        setTimeout(function () {
          reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);
          connect();
        }, reconnectDelay);
      };

      socket.onerror = function () {
        // onclose will fire after this and handle reconnection.
      };
    }

    connect();
  };
})();
