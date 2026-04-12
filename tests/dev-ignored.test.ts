import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import { buildWatchIgnored } from '@/dev-ignored';

const createTwMock = () =>
  ({
    boot: {
      excludeRegExp: /^.*\.meta$|^\.git$/,
    },
  } as any);

describe('buildWatchIgnored', () => {
  test('does not ignore .meta under src but ignores .meta under wiki', () => {
    const tempDir = fs.mkdtempSync(
      path.join(tmpdir(), 'tw-plugin-dev-ignore-'),
    );
    const srcDir = path.join(tempDir, 'src');
    const wikiDir = path.join(tempDir, 'wiki');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(wikiDir, { recursive: true });

    const ignored = buildWatchIgnored(createTwMock(), srcDir, wikiDir);
    const srcMeta = path.join(srcDir, 'a.ts.meta');
    const wikiMeta = path.join(wikiDir, 'tiddlers', 'a.tid.meta');

    expect(ignored(srcMeta)).toBe(false);
    expect(ignored(wikiMeta)).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('ignores volatile wiki system files with optional numeric suffix', () => {
    const tempDir = fs.mkdtempSync(
      path.join(tmpdir(), 'tw-plugin-dev-ignore-'),
    );
    const srcDir = path.join(tempDir, 'src');
    const wikiDir = path.join(tempDir, 'wiki');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'tiddlers', 'system'), { recursive: true });

    const ignored = buildWatchIgnored(createTwMock(), srcDir, wikiDir);
    const story = path.join(wikiDir, 'tiddlers', 'system', '$__StoryList.tid');
    const storySuffix = path.join(
      wikiDir,
      'tiddlers',
      'system',
      '$__StoryList_1.tid',
    );
    const layout = path.join(wikiDir, 'tiddlers', 'system', '$__layout.tid');
    const layoutSuffix = path.join(
      wikiDir,
      'tiddlers',
      'system',
      '$__layout_2.tid',
    );
    const palette = path.join(wikiDir, 'tiddlers', 'system', '$__palette.tid');
    const paletteSuffix = path.join(
      wikiDir,
      'tiddlers',
      'system',
      '$__palette_3.tid',
    );

    expect(ignored(story)).toBe(true);
    expect(ignored(storySuffix)).toBe(true);
    expect(ignored(layout)).toBe(true);
    expect(ignored(layoutSuffix)).toBe(true);
    expect(ignored(palette)).toBe(true);
    expect(ignored(paletteSuffix)).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('respects wiki .gitignore rules', () => {
    const tempDir = fs.mkdtempSync(
      path.join(tmpdir(), 'tw-plugin-dev-ignore-'),
    );
    const srcDir = path.join(tempDir, 'src');
    const wikiDir = path.join(tempDir, 'wiki');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'tiddlers'), { recursive: true });
    fs.writeFileSync(
      path.join(wikiDir, '.gitignore'),
      'tiddlers/generated/**\n',
    );

    const ignored = buildWatchIgnored(createTwMock(), srcDir, wikiDir);
    const generated = path.join(wikiDir, 'tiddlers', 'generated', 'cache.tid');
    const normal = path.join(wikiDir, 'tiddlers', 'normal.tid');

    expect(ignored(generated)).toBe(true);
    expect(ignored(normal)).toBe(false);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
