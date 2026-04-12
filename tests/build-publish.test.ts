import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

const createTempDir = () =>
  fs.mkdtempSync(path.join(tmpdir(), 'tw-plugin-dev-'));

describe('build and publish workflows', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('build writes compiled plugin json files into the output directory', async () => {
    const outputDir = createTempDir();
    const rebuild = jest.fn(async () => [
      { title: '$:/plugins/acme/demo', text: 'plugin-body' },
    ]);
    const generateTiddlerFilepath = jest.fn(() => 'plugins/acme/demo');

    jest.doMock('../src/packup', () => ({ rebuild }));
    jest.doMock('../src/utils', () => ({
      tiddlywiki: () => ({
        utils: { generateTiddlerFilepath },
      }),
      mkdirsForFileSync: (fileName: string) => {
        fs.mkdirSync(path.dirname(fileName), { recursive: true });
      },
      waitForFile: async () => undefined,
    }));

    const { build } = await import('../src/build');
    await build(outputDir, undefined, 'src');

    const resultPath = path.join(outputDir, 'demo.json');
    expect(fs.existsSync(resultPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(resultPath, 'utf-8'))).toMatchObject({
      title: '$:/plugins/acme/demo',
      text: 'plugin-body',
    });
    expect(rebuild).toHaveBeenCalledWith(
      expect.anything(),
      'src',
      undefined,
      false,
      undefined,
    );
  });

  test('publishOnlineHTML writes external media and renders html output', async () => {
    const wikiDir = createTempDir();
    const distDir = createTempDir();
    fs.writeFileSync(path.join(wikiDir, 'tiddlywiki.info'), '{"plugins":[]}');

    const rebuild = jest.fn(async () => [
      { title: '$:/plugins/acme/demo', text: 'plugin-body' },
    ]);
    const renderCalls: Array<{
      preloadTiddlers: Record<string, unknown>[];
      dir: string;
      commands: string[];
    }> = [];
    const fakeWiki = {
      version: '5.3.8',
      config: {
        contentTypeInfo: {
          'image/png': { extension: '.png', encoding: 'base64' },
          'text/vnd.tiddlywiki': { extension: '.tid', encoding: 'utf8' },
        },
      },
      wiki: {
        each: (
          callback: (
            tiddler: { fields: Record<string, unknown> },
            title: string,
          ) => void,
        ) => {
          callback(
            {
              fields: {
                title: 'HelloThere',
                text: 'hello world',
                type: 'text/vnd.tiddlywiki',
              },
            },
            'HelloThere',
          );
          callback(
            {
              fields: {
                title: 'Logo',
                text: 'ZmFrZS1pbWFnZQ==',
                type: 'image/png',
              },
            },
            'Logo',
          );
        },
        isBinaryTiddler: (title: string) => title === 'Logo',
        isImageTiddler: (title: string) => title === 'Logo',
      },
    };
    const tiddlywiki = jest.fn(
      (
        preloadTiddlers: Record<string, unknown>[] = [],
        dir = '.',
        commands: string[] = [],
      ) => {
        if (commands.length === 0) {
          return fakeWiki;
        }

        renderCalls.push({ preloadTiddlers, dir, commands });
        const outputIndex = commands.indexOf('--output');
        const outputDir = commands[outputIndex + 1];
        fs.writeFileSync(path.join(outputDir, 'site.html'), '<html>ok</html>');
        fs.writeFileSync(
          path.join(outputDir, `tiddlywikicore-${fakeWiki.version}.js`),
          'core',
        );
        return fakeWiki;
      },
    );

    jest.doMock('../src/packup', () => ({ rebuild }));
    jest.doMock('../src/build', () => ({
      buildLibrary: jest.fn(async () => ({
        '$:/plugins/acme/demo': {
          title: '$:/plugins/acme/demo',
          text: 'library-plugin',
        },
      })),
    }));
    jest.doMock('../src/utils', () => ({
      tiddlywiki,
      mkdirsForFileSync: (fileName: string) => {
        fs.mkdirSync(path.dirname(fileName), { recursive: true });
      },
      waitForFile: async () => undefined,
    }));

    const { publishOnlineHTML } = await import('../src/publish');
    await publishOnlineHTML(
      wikiDir,
      distDir,
      'site.html',
      '[all[]]',
      false,
      'src',
    );

    expect(fs.existsSync(path.join(distDir, 'site.html'))).toBe(true);
    expect(
      fs.existsSync(
        path.join(distDir, `tiddlywikicore-${fakeWiki.version}.js`),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(distDir, 'media', 'Logo.png'))).toBe(true);
    expect(renderCalls[0].preloadTiddlers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: '$:/plugins/acme/demo' }),
        expect.objectContaining({ title: '$:/Modern.TiddlyDev/no-cache-html' }),
        expect.objectContaining({
          title: 'Logo',
          _canonical_uri: './media/Logo.png',
        }),
      ]),
    );
  });

  test('publishOfflineHTML injects built library tiddlers into the rendered wiki', async () => {
    const wikiDir = createTempDir();
    const distDir = createTempDir();
    fs.writeFileSync(path.join(wikiDir, 'tiddlywiki.info'), '{"plugins":[]}');

    const renderCalls: Array<Record<string, unknown>[]> = [];
    const fakeWiki = {
      wiki: {
        each: (
          callback: (
            tiddler: { fields: Record<string, unknown> },
            title: string,
          ) => void,
        ) => {
          callback(
            {
              fields: {
                title: 'HelloThere',
                text: 'hello world',
                type: 'text/vnd.tiddlywiki',
              },
            },
            'HelloThere',
          );
        },
      },
    };
    const tiddlywiki = jest.fn(
      (
        preloadTiddlers: Record<string, unknown>[] = [],
        _wikiDir = '.',
        commands: string[] = [],
      ) => {
        void _wikiDir;
        if (commands.length === 0) {
          return fakeWiki;
        }

        renderCalls.push(preloadTiddlers);
        const outputIndex = commands.indexOf('--output');
        const outputDir = commands[outputIndex + 1];
        fs.writeFileSync(
          path.join(outputDir, 'offline.html'),
          '<html>offline</html>',
        );
        return fakeWiki;
      },
    );
    const buildLibrary = jest.fn(async () => ({
      '$:/plugins/acme/demo': {
        title: '$:/plugins/acme/demo',
        text: 'library-plugin',
      },
    }));

    jest.doMock('../src/packup', () => ({ rebuild: jest.fn() }));
    jest.doMock('../src/build', () => ({ buildLibrary }));
    jest.doMock('../src/utils', () => ({
      tiddlywiki,
      mkdirsForFileSync: (fileName: string) => {
        fs.mkdirSync(path.dirname(fileName), { recursive: true });
      },
      waitForFile: async () => undefined,
    }));

    const { publishOfflineHTML } = await import('../src/publish');
    await publishOfflineHTML(
      wikiDir,
      distDir,
      'offline.html',
      '[all[]]',
      true,
      'src',
    );

    expect(buildLibrary).toHaveBeenCalledWith(
      path.join(distDir, 'library'),
      undefined,
      'src',
      wikiDir,
    );
    expect(fs.existsSync(path.join(distDir, 'offline.html'))).toBe(true);
    expect(renderCalls[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: '$:/plugins/acme/demo',
          text: 'library-plugin',
        }),
        expect.objectContaining({ title: '$:/Modern.TiddlyDev/no-cache-html' }),
      ]),
    );
  });
});
