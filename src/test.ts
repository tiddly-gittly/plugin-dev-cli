import tw from 'tiddlywiki';

import { rebuild } from './packup';
import { tiddlywiki } from './utils';

// Run tests using official Jasmine plugin
export const runTest = async (
  wiki: string,
  src: string,
  excludeFilter?: string,
) => {
  const $tw1 = tiddlywiki([], wiki);
  $tw1.wiki.deleteTiddler('$:/Modern.TiddlyDev/devWebsocket/listener');
  const plugins = await rebuild($tw1, src, [], true, excludeFilter);
  const $tw = tw.TiddlyWiki();

  $tw.preloadTiddlerArray(plugins);

  $tw.boot.extraPlugins = [
    ...($tw.boot.extraPlugins ?? []),
    'plugins/tiddlywiki/jasmine',
  ];

  $tw.boot.argv = [wiki, '--verbose', '--version', '--test'];

  $tw.boot.boot();
};
