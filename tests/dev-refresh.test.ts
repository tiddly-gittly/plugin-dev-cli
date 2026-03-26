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
