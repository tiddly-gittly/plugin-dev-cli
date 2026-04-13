(function () {
  // eslint-disable-next-line no-undef
  const moduleExports = exports;
  // Export name and synchronous status
  moduleExports.name = 'devweb-listner';
  moduleExports.platforms = ['browser'];
  moduleExports.after = ['load-modules'];
  moduleExports.synchronous = true;
  moduleExports.startup = function () {
    const ws =
      (typeof globalThis !== 'undefined' && globalThis.WebSocket) ||
      // eslint-disable-next-line no-undef
      (typeof window !== 'undefined' ? window.WebSocket : undefined);
    if (!ws) {
      console.error(
        '[Modern.TiddlyDev]',
        'Unsupported broswer, need WebSocket support',
      );
      return;
    }
    // eslint-disable-next-line no-undef
    const port = $$$$port$$$$;
    const protocol =
      // eslint-disable-next-line no-undef
      document.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = document.location.hostname;
    const socket = new ws(`${protocol}://${host}:${port}`);
    /*
     * Note: socket.send('pong') will not work,
     *       and onmessage will not handle ping message.
     *       Since broswer can handle ping/pong automatically.
     *       You should just focus ping/pong check on server side,
     *       See: https://javascript.info/websocket  */
    socket.onopen = () => {
      // eslint-disable-next-line no-console
      console.debug(
        '[Modern.TiddlyDev]',
        'Dev WebSocket connected, this web page can refresh automatically.',
      );
    };
    socket.onmessage = event => {
      switch (event.data) {
        case 'bye': {
          socket.close();
          break;
        }
        case 'refresh': {
          socket.close();
          document.location.reload();
          break;
        }
        default: {
          break;
        }
      }
    };
    socket.onclose = () => {
      console.error(
        '[Modern.TiddlyDev]',
        'The development server has disconnected. Refresh the page if necessary.',
      );
    };
  };
})();
