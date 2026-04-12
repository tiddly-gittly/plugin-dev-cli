const listenerTemplate = `(function () {
  const moduleExports = exports;
  moduleExports.name = 'devweb-listner';
  moduleExports.platforms = ['browser'];
  moduleExports.after = ['load-modules'];
  moduleExports.synchronous = true;
  moduleExports.startup = function () {
    const ws =
      typeof globalThis === 'undefined'
        ? typeof window === 'undefined'
          ? undefined
          : window.WebSocket
        : globalThis.WebSocket;
    if (ws === undefined) {
      console.error(
        '[Modern.TiddlyDev]',
        'Unsupported broswer, need WebSocket support',
      );
    }
    const port = __PORT__;
    const host = document.location.hostname;
    const socket = new WebSocket(\`ws://\${host}:\${port}\`);
    socket.onopen = () => {
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
`;

export const renderDevWebListenerScript = (port: number) =>
  listenerTemplate.replace('__PORT__', String(port));
