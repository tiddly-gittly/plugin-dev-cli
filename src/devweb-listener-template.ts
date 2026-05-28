const listenerTemplate = `(function () {
  const moduleExports = exports;
  moduleExports.name = 'devweb-listner';
  moduleExports.platforms = ['browser'];
  moduleExports.after = ['load-modules'];
  moduleExports.synchronous = true;
  moduleExports.startup = function () {
    const WS =
      (typeof globalThis !== 'undefined' && globalThis.WebSocket) ||
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
    var protocol = document.location.protocol === 'https:' ? 'wss' : 'ws';
    var url = protocol + '://' + document.location.host + '/__dev_ws';
    var reconnectDelay = 1000;
    var maxReconnectDelay = 10000;
    var reconnectTimer = null;
    var disposed = false;

    function connect() {
      if (disposed) return;
      var socket = new WS(url);

      socket.onopen = function () {
        reconnectDelay = 1000; // reset backoff
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
            document.location.reload();
            break;
          }
          default:
            break;
        }
      };

      socket.onclose = function () {
        if (disposed) return;
        console.warn(
          '[Modern.TiddlyDev]',
          'Dev WebSocket closed - reconnecting in ' +
            Math.round(reconnectDelay / 1000) +
            's...',
        );
        reconnectTimer = setTimeout(function () {
          reconnectDelay = Math.min(
            reconnectDelay * 1.5,
            maxReconnectDelay,
          );
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
`;

export const renderDevWebListenerScript = () => listenerTemplate;
