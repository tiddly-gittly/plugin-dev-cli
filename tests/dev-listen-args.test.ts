import { buildListenArgs } from '@/dev-listen-args';

describe('buildListenArgs', () => {
  test('defaults to localhost and read-only mode', () => {
    const args = buildListenArgs({
      wikiPath: 'wiki-dir',
      port: 8080,
    });

    expect(args).toEqual([
      'wiki-dir',
      '--listen',
      'port=8080',
      'writers=(authenticated)',
    ]);
  });

  test('enables lan host when --lan is set', () => {
    const args = buildListenArgs({
      wikiPath: 'wiki-dir',
      port: 8080,
      lan: true,
    });

    expect(args).toEqual([
      'wiki-dir',
      '--listen',
      'port=8080',
      'host=0.0.0.0',
      'writers=(authenticated)',
    ]);
  });

  test('does not force writers restriction when --write-wiki is set', () => {
    const args = buildListenArgs({
      wikiPath: 'wiki-dir',
      port: 8080,
      writeWiki: true,
    });

    expect(args).toEqual(['wiki-dir', '--listen', 'port=8080']);
  });
});
