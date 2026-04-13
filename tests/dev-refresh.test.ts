import {
  createDevRefreshHandler,
  DevRefreshWiki,
  devWritePlugins,
} from '@/dev-refresh';

const createWiki = () => {
  const state = {
    preloaded: [] as Record<string, unknown>[],
    arrays: [] as Record<string, unknown>[][],
    plugins: [] as string[][],
  };
  const wiki: DevRefreshWiki = {
    runtime: { state },
    preloadTiddler: tiddler => state.preloaded.push(tiddler),
    preloadTiddlerArray: tiddlers => state.arrays.push(tiddlers),
    appendExtraPlugins: plugins => state.plugins.push(plugins),
  };

  return { wiki, state };
};

describe('createDevRefreshHandler', () => {
  test('does not inject write plugins by default', async () => {
    const notifyRefresh = jest.fn();
    const reportError = jest.fn();
    const { wiki, state } = createWiki();
    const handler = createDevRefreshHandler({
      listenerScript: 'listener-script',
      rebuildPlugins: async () => [{ title: '$:/plugins/acme/demo', text: 'ok' }],
      createWiki: () => wiki,
      startServer: async () => true,
      notifyRefresh,
      reportError,
    });

    await handler('changed.ts');

    expect(state.plugins).toEqual([]);
    expect(notifyRefresh).toHaveBeenCalledTimes(1);
    expect(reportError).not.toHaveBeenCalled();
  });

  test('preloads empty SyncFilter when writeWiki is false to prevent filesystem save tasks', async () => {
    const { wiki, state } = createWiki();
    const handler = createDevRefreshHandler({
      listenerScript: 'listener-script',
      writeWiki: false,
      rebuildPlugins: async () => [],
      createWiki: () => wiki,
      startServer: async () => true,
      notifyRefresh: jest.fn(),
      reportError: jest.fn(),
    });

    await handler('changed.ts');

    // $:/config/SyncFilter must be preloaded with a filter that matches nothing,
    // so the server-side filesystem syncadaptor never dispatches save tasks.
    const syncFilterTiddler = state.preloaded.find(
      t => t.title === '$:/config/SyncFilter',
    );
    expect(syncFilterTiddler).toBeDefined();
    expect(syncFilterTiddler?.text).toBe('[all[]] -[all[]]');
    // filesystem/tiddlyweb extra plugins must NOT be appended
    expect(state.plugins).toEqual([]);
  });

  test('does NOT preload SyncFilter override when writeWiki is true', async () => {
    const { wiki, state } = createWiki();
    const handler = createDevRefreshHandler({
      listenerScript: 'listener-script',
      writeWiki: true,
      rebuildPlugins: async () => [],
      createWiki: () => wiki,
      startServer: async () => true,
      notifyRefresh: jest.fn(),
      reportError: jest.fn(),
    });

    await handler('changed.ts');

    const syncFilterTiddler = state.preloaded.find(
      t => t.title === '$:/config/SyncFilter',
    );
    expect(syncFilterTiddler).toBeUndefined();
    // write plugins must be appended
    expect(state.plugins).toEqual([devWritePlugins]);
  });

  test('recovers after a rebuild failure and refreshes after syntax is fixed', async () => {
    const reportError = jest.fn();
    const notifyRefresh = jest.fn();
    const startServer = jest.fn(async () => true);
    const wikis: Array<ReturnType<typeof createWiki>> = [];
    let rebuildAttempt = 0;
    const handler = createDevRefreshHandler({
      listenerScript: 'listener-script',
      rebuildPlugins: async changedPaths => {
        rebuildAttempt += 1;
        if (rebuildAttempt === 1) {
          throw new Error(`syntax error in ${changedPaths[0]}`);
        }
        return [{ title: '$:/plugins/acme/demo', text: 'ok' }];
      },
      createWiki: () => {
        const wiki = createWiki();
        wikis.push(wiki);
        return wiki.wiki;
      },
      startServer,
      notifyRefresh,
      reportError,
    });

    await handler('broken.ts');
    await handler('fixed.ts');

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(startServer).toHaveBeenCalledTimes(1);
    expect(notifyRefresh).toHaveBeenCalledTimes(1);
    expect(wikis[0].state.preloaded[0]).toMatchObject({
      title: '$:/Modern.TiddlyDev/devWebsocket/listener',
      text: 'listener-script',
    });
    expect(wikis[0].state.arrays[0]).toEqual([
      { title: '$:/plugins/acme/demo', text: 'ok' },
    ]);
  });

  test('does not refresh the browser when server startup fails', async () => {
    const notifyRefresh = jest.fn();
    const reportError = jest.fn();
    const { wiki, state } = createWiki();
    const handler = createDevRefreshHandler({
      listenerScript: 'listener-script',
      writeWiki: true,
      rebuildPlugins: async () => [
        { title: '$:/plugins/acme/demo', text: 'ok' },
      ],
      createWiki: () => wiki,
      startServer: async () => false,
      notifyRefresh,
      reportError,
    });

    await handler('broken.ts');

    expect(notifyRefresh).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
    expect(state.plugins).toEqual([devWritePlugins]);
  });
});
