describe('runTest', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('boots jasmine test runtime with rebuilt plugins', async () => {
    const deleteTiddler = jest.fn();
    const preloadTiddlerArray = jest.fn();
    const boot = jest.fn();
    const rebuild = jest.fn(async () => [{ title: '$:/plugins/acme/demo' }]);
    const runtime = {
      preloadTiddlerArray,
      boot: {
        extraPlugins: [] as string[],
        argv: [] as string[],
        boot,
      },
    };

    jest.doMock('../src/utils', () => ({
      tiddlywiki: () => ({ wiki: { deleteTiddler } }),
    }));
    jest.doMock('../src/packup', () => ({ rebuild }));
    jest.doMock('tiddlywiki', () => ({
      __esModule: true,
      default: {
        TiddlyWiki: () => runtime,
      },
    }));

    const { runTest } = await import('../src/test');
    await runTest('wiki-dir', 'src-dir', '[tag[skip]]');

    expect(deleteTiddler).toHaveBeenCalledWith(
      '$:/Modern.TiddlyDev/devWebsocket/listener',
    );
    expect(rebuild).toHaveBeenCalledWith(
      expect.anything(),
      'src-dir',
      [],
      true,
      '[tag[skip]]',
    );
    expect(preloadTiddlerArray).toHaveBeenCalledWith([
      { title: '$:/plugins/acme/demo' },
    ]);
    expect(runtime.boot.extraPlugins).toEqual(['plugins/tiddlywiki/jasmine']);
    expect(runtime.boot.argv).toEqual([
      'wiki-dir',
      '--verbose',
      '--version',
      '--test',
    ]);
    expect(boot).toHaveBeenCalledTimes(1);
  });
});
