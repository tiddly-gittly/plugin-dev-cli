import { buildListenArgs } from '@/dev-listen-args';

describe('buildListenArgs', () => {
  test('defaults to localhost without forcing writer restrictions', () => {
    const args = buildListenArgs({
      wikiPath: 'wiki-dir',
      port: 8080,
    });

    expect(args).toEqual(['wiki-dir', '--listen', 'port=8080']);
  });

  test('enables lan host when --lan is set', () => {
    const args = buildListenArgs({
      wikiPath: 'wiki-dir',
      port: 8080,
      lan: true,
    });

    expect(args).toEqual(['wiki-dir', '--listen', 'port=8080', 'host=0.0.0.0']);
  });

  test('keeps args stable when --write-wiki is set', () => {
    const args = buildListenArgs({
      wikiPath: 'wiki-dir',
      port: 8080,
      writeWiki: true,
    });

    expect(args).toEqual(['wiki-dir', '--listen', 'port=8080']);
  });
});
