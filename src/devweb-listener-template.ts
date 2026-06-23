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
    // The build generation is baked into the URL so the dev server can decide,
    // at connection time, whether this page belongs to an older build and must
    // reload. This is timing-independent and survives the WebSocket reconnect
    // gap that happens whenever the server is restarted.
    var generation = __DEV_BUILD_GENERATION__;
    var protocol = document.location.protocol === 'https:' ? 'wss' : 'ws';
    var url =
      protocol +
      '://' +
      document.location.host +
      '/__dev_ws?gen=' +
      generation;
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

      return socket;
    }

    var socket = connect();

    // ---------- watch for browser-initiated saves ----------

    // When the browser saves tiddlers to disk (e.g. bulk-installing plugins,
    // editing tiddlers in write-wiki mode) tell the dev server to pause
    // watch-triggered restarts.  Otherwise the first saved file would trigger
    // a chokidar event → server restart → remaining saves fail with
    // "Network Error" because the server is restarting.
    var saveEndTimer = null;
    var saving = false;
    var notifySaveStart = function () {
      if (saving) return;
      saving = true;
      try { socket.send('save-start'); } catch (_) {}
    };
    var notifySaveEnd = function () {
      if (!saving) return;
      saving = false;
      try { socket.send('save-end'); } catch (_) {}
    };
    var debouncedSaveEnd = function () {
      if (saveEndTimer) clearTimeout(saveEndTimer);
      // Wait 1500ms after the last hook call — that is comfortably longer
      // than chokidar's awaitWriteFinish stabilityThreshold (1000ms).
      saveEndTimer = setTimeout(notifySaveEnd, 1500);
    };

    // TW5 fires these hooks synchronously, once per tiddler.  We keep the
    // save-start notification alive by resetting the debounce timer on each
    // hook call and only send save-end after the trailing edge.
    if (typeof $tw !== 'undefined' && $tw && $tw.hooks) {
      $tw.hooks.addHook('th-saving-tiddler', function () {
        notifySaveStart();
        debouncedSaveEnd();
        return arguments[0]; // pass through unchanged
      });
      $tw.hooks.addHook('th-deleting-tiddler', function () {
        notifySaveStart();
        debouncedSaveEnd();
        return arguments[0];
      });
    }
  };
})();
`;

/**
 * Render the dev WebSocket listener startup script.
 *
 * The current build `generation` is baked into the script so the page reports
 * which build it was served from. The dev server compares this value against
 * its current generation when the WebSocket connects and, if the page is from
 * an older build, immediately tells it to refresh. This makes auto-refresh
 * robust against the reconnect gap that occurs whenever the wiki server is
 * restarted after a rebuild.
 */
export const renderDevWebListenerScript = (generation = 0) => {
  const safeGeneration = Number.isFinite(generation)
    ? Math.trunc(generation)
    : 0;
  return listenerTemplate.replace(
    '__DEV_BUILD_GENERATION__',
    String(safeGeneration),
  );
};
