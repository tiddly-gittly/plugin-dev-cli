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
  const makeGen = () => {
    const gen = 0;
    return {
      next: () => gen,
      render: (g: number) => `listener-gen-${g}`,
    };
  };

  test('does not inject write plugins by default', async () => {
    const notifyRefresh = jest.fn();
    const reportError = jest.fn();
    const { wiki, state } = createWiki();
    const gen = makeGen();
    const handler = createDevRefreshHandler({
      renderListenerScript: gen.render,
      nextGeneration: gen.next,
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
    const gen = makeGen();
    const handler = createDevRefreshHandler({
      renderListenerScript: gen.render,
      nextGeneration: gen.next,
      writeWiki: false,
      rebuildPlugins: async () => [{ title: '$:/plugins/test', text: '' }],
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
    expect(syncFilterTiddler?.text).toBe('');
    // filesystem/tiddlyweb extra plugins must NOT be appended
    expect(state.plugins).toEqual([]);
  });

  test('does NOT preload SyncFilter override when writeWiki is true', async () => {
    const { wiki, state } = createWiki();
    const gen = makeGen();
    const handler = createDevRefreshHandler({
      renderListenerScript: gen.render,
      nextGeneration: gen.next,
      writeWiki: true,
      rebuildPlugins: async () => [{ title: '$:/plugins/test', text: '' }],
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
    const gen = makeGen();
    const handler = createDevRefreshHandler({
      renderListenerScript: gen.render,
      nextGeneration: gen.next,
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
      text: 'listener-gen-0',
    });
    expect(wikis[0].state.arrays[0]).toEqual([
      { title: '$:/plugins/acme/demo', text: 'ok' },
    ]);
  });

  test('does not refresh the browser when server startup fails', async () => {
    const notifyRefresh = jest.fn();
    const reportError = jest.fn();
    const { wiki, state } = createWiki();
    const gen = makeGen();
    const handler = createDevRefreshHandler({
      renderListenerScript: gen.render,
      nextGeneration: gen.next,
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

  test('startServer receives the correct generation for each rebuild', async () => {
    const generations: number[] = [];
    const gen = makeGen();
    let genCounter = -1;
    const handler = createDevRefreshHandler({
      renderListenerScript: gen.render,
      // simulate dev.ts: increment after build, pass to nextGeneration
      nextGeneration: () => ++genCounter,
      rebuildPlugins: async () => [{ title: '$:/plugins/test', text: 'ok' }],
      createWiki: () => createWiki().wiki,
      startServer: async (_wiki, _paths, generation) => {
        generations.push(generation);
        return true;
      },
      notifyRefresh: jest.fn(),
      reportError: jest.fn(),
    });

    await handler('a.ts');
    await handler('b.ts');

    expect(generations).toEqual([0, 1]);
  });

  test('generation does NOT advance when rebuild throws (failed gen never served)', async () => {
    const generations: number[] = [];
    const gen = makeGen();
    let genCounter = -1;
    let shouldFail = true;
    const handler = createDevRefreshHandler({
      renderListenerScript: gen.render,
      nextGeneration: () => ++genCounter,
      rebuildPlugins: async () => {
        if (shouldFail) {
          throw new Error('build failed');
        }
        return [{ title: '$:/plugins/test', text: 'ok' }];
      },
      createWiki: () => createWiki().wiki,
      startServer: async (_wiki, _paths, generation) => {
        generations.push(generation);
        return true;
      },
      notifyRefresh: jest.fn(),
      reportError: jest.fn(),
    });

    await handler('broken.ts');
    shouldFail = false;
    await handler('fixed.ts');

    // The first (failed) rebuild should NOT advance genCounter because
    // nextGeneration() is only called inside runBatch after rebuildPlugins
    // succeeds. So the first successful startServer gets gen 0.
    expect(generations).toEqual([0]);
  });

  test('skips server restart when rebuildPlugins returns empty (no plugins to load)', async () => {
    const notifyRefresh = jest.fn();
    const startServer = jest.fn(async () => true);
    const handler = createDevRefreshHandler({
      renderListenerScript: (g: number) => `gen-${g}`,
      nextGeneration: () => 0,
      rebuildPlugins: async () => [],
      createWiki: () => createWiki().wiki,
      startServer,
      notifyRefresh,
      reportError: jest.fn(),
    });

    await handler('wiki/tiddlers/$__StoryList.tid');

    // Server must NOT be restarted for wiki-only file changes
    expect(startServer).not.toHaveBeenCalled();
    // Browsers must still be notified so they pick up the filesystem change
    expect(notifyRefresh).toHaveBeenCalledTimes(1);
  });
});
