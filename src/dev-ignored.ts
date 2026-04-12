import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
import type { ITiddlyWiki } from 'tiddlywiki';

// TiddlyWiki system tiddler files written back to disk during a running
// session (e.g. StoryList, layout, palette). Watching them would cause
// reload loops. Matches names like:
//   $__StoryList.tid   $__StoryList_1.tid
//   $__layout.tid      $__layout_1.tid
//   $__palette.tid     $__palette_1.tid
const wikiLoopProneBasenameRegExp =
  /^\$__(?:StoryList|layout|palette)(?:_\d+)?\.tid$/;

/**
 * Build a chokidar `ignored` predicate for the dev watcher.
 *
 * - **src directory**: uses TW's exclude rules but *allows* `.meta` files so
 *   that editing metadata triggers a rebuild.  (TW excludes `.meta` from its
 *   own file loading because those files are read as sidecar data, not as
 *   independent tiddlers.)
 * - **wiki directory**: keeps TW's full exclude rules, additionally ignores
 *   volatile system tiddler files, and respects `.gitignore` to prevent
 *   reload loops caused by files written during a reload.
 */
export const buildWatchIgnored = (
  $tw: ITiddlyWiki,
  srcDir: string,
  wikiDir: string,
) => {
  // Strip the .meta pattern so src/.meta changes trigger rebuilds.
  const twExcludeSource = $tw.boot.excludeRegExp?.source
    .split('|')
    .filter((part: string) => part !== '^.*\\.meta$')
    .join('|');
  const srcExcludeRegExp = twExcludeSource
    ? new RegExp(twExcludeSource)
    : undefined;

  // Load .gitignore rules relative to the wiki root.
  const wikiRoot = path.resolve(wikiDir);
  const ig = ignore();
  for (const gip of [
    path.resolve('.', '.gitignore'),
    path.resolve(wikiDir, '.gitignore'),
  ]) {
    if (fs.existsSync(gip)) {
      ig.add(fs.readFileSync(gip, 'utf-8'));
    }
  }

  const isIgnoredByGitignore = (filePath: string): boolean => {
    try {
      const relative = path.relative(wikiRoot, filePath).replace(/\\/g, '/');
      if (relative.startsWith('..')) {
        return false;
      }
      return ig.ignores(relative);
    } catch {
      return false;
    }
  };

  const srcRoot = path.resolve(srcDir);

  return (filePath: string): boolean => {
    const basename = path.basename(filePath);
    const resolvedPath = path.resolve(filePath);
    const isInSrc =
      resolvedPath.startsWith(srcRoot + path.sep) || resolvedPath === srcRoot;

    if (isInSrc) {
      return srcExcludeRegExp ? srcExcludeRegExp.test(basename) : false;
    }

    if ($tw.boot.excludeRegExp?.test(basename)) {
      return true;
    }
    if (wikiLoopProneBasenameRegExp.test(basename)) {
      return true;
    }
    return isIgnoredByGitignore(filePath);
  };
};
