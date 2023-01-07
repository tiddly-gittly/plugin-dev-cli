import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { ITiddlerFields } from 'tw5-typed';
import { buildLibrary } from './build';
import { tiddlywiki, mkdirsForFileSync, waitForFile } from './utils';

/** 项目路径 */
const bypassTiddlers = new Set([
  '$:/core',
  '$:/UpgradeLibrary',
  '$:/UpgradeLibrary/List',
]);

/**
 * 构建在线HTML版本：核心JS和资源文件不包括在HTML中， 下载后不能使用
 * @param {string} dist 目标路径，空或者不填则默认为'dist'
 * @param {string} htmlName HTML名称，空或者不填则默认为'index.html'
 * @param {boolean} minify 是否最小化JS和HTML，默认为true
 * @param {string} excludeFilter 要排除的tiddler的过滤表达式，默认为'-[is[draft]]'
 */
export const publishOnlineHTML = async (
  wikiPath = 'wiki',
  dist = 'dist',
  htmlName = 'index.html',
  excludeFilter = '-[is[draft]]',
) => {
  // 构建插件库，导出插件
  const wikiFolder = path.resolve(wikiPath);
  const distDir = path.resolve(dist);
  const plugins = await buildLibrary(path.join(dist, 'library'));

  // 读取、导出外置资源、处理 tiddler
  const $tw = tiddlywiki([], wikiFolder);
  const tiddlers: Record<string, ITiddlerFields> = {};
  const savePromises: Promise<NodeJS.ErrnoException | null>[] = [];
  mkdirsForFileSync(path.resolve(distDir, 'media', '1'));
  $tw.wiki.each(({ fields }, title: string) => {
    if (
      bypassTiddlers.has(title) ||
      title.startsWith('$:/boot/') ||
      title.startsWith('$:/temp/')
    ) {
      return;
    }
    if ($tw.wiki.isBinaryTiddler(title) || $tw.wiki.isImageTiddler(title)) {
      const { extension, encoding } = $tw.config.contentTypeInfo[
        fields.type || 'text/vnd.tiddlywiki'
      ] ?? { extension: '.bin', encoding: 'base64' };
      const fileName = encodeURIComponent(
        title.endsWith(extension) ? title : `${title}${extension}`,
      );
      savePromises.push(
        new Promise(resolve =>
          fs.writeFile(
            path.resolve(distDir, 'media', fileName),
            fields.text,
            encoding as any,
            resolve,
          ),
        ),
      );
      tiddlers[title] = {
        ...fields,
        text: '',
        _canonical_uri: `./media/${encodeURIComponent(fileName)}`,
      };
    } else {
      tiddlers[title] = { ...fields };
    }
  });

  // 将构建好的插件注入
  Object.entries(plugins).forEach(
    ([title, tiddler]) => (tiddlers[title] = tiddler),
  );

  // 构建
  const tmpFolder = fs.mkdtempSync(path.resolve(tmpdir(), 'tiddlywiki-'));
  try {
    fs.cpSync(
      path.resolve(wikiFolder, 'tiddlywiki.info'),
      path.resolve(tmpFolder, 'tiddlywiki.info'),
    );
    tiddlywiki(Object.values(tiddlers), tmpFolder, [
      ...['--output', distDir] /* 指定输出路径 */,
      ...[
        '--rendertiddler',
        '$:/core/save/offline-external-js',
        htmlName,
        'text/plain',
        '',
        'publishFilter',
        excludeFilter,
      ] /* 导出无核心的HTML文件 */,
      ...[
        '--rendertiddler',
        '$:/core/templates/tiddlywiki5.js',
        `tiddlywikicore-${$tw.version}.js`,
        'text/plain',
      ] /* 导出核心 */,
    ]);
    await waitForFile(
      path.resolve(distDir, `tiddlywikicore-${$tw.version}.js`),
    );
  } catch (e) {
    console.error(e);
  }
  fs.rmSync(tmpFolder, { recursive: true, force: true });
  (await Promise.all(savePromises)).forEach(error => {
    if (error) {
      console.error(error);
    }
  });
};

/**
 * 构建离线HTML版本：核心JS和资源文件包括在HTML中， 下载后可以使用(就是单文件版本的wiki)
 * @param {string} dist 目标路径，空或者不填则默认为'dist'
 * @param {string} htmlName HTML名称，空或者不填则默认为'index.html'
 * @param {boolean} minify 是否最小化JS和HTML，默认为true
 * @param {string} excludeFilter 要排除的tiddler的过滤表达式，默认为'-[is[draft]]'
 */
export const publishOfflineHTML = async (
  wikiPath = 'wiki',
  dist = 'dist',
  htmlName = 'index.html',
  excludeFilter = '-[is[draft]]',
) => {
  // 构建插件库，导出插件
  const distDir = path.resolve(dist);
  const wikiFolder = path.resolve(wikiPath);
  const plugins = await buildLibrary(path.join(dist, 'library'));

  // 读取所有 tiddler
  const $tw = tiddlywiki([], wikiFolder);
  const tiddlers: Record<string, ITiddlerFields> = {};
  $tw.wiki.each(({ fields }, title: string) => {
    if (
      bypassTiddlers.has(title) ||
      title.startsWith('$:/boot/') ||
      title.startsWith('$:/temp/')
    ) {
      return;
    }
    tiddlers[title] = { ...fields };
  });

  // 将构建好的插件注入
  Object.entries(plugins).forEach(
    ([title, tiddler]) => (tiddlers[title] = tiddler),
  );

  // 构建
  const tmpFolder = fs.mkdtempSync(path.resolve(tmpdir(), 'tiddlywiki-'));
  try {
    fs.cpSync(
      path.resolve(wikiFolder, 'tiddlywiki.info'),
      path.resolve(tmpFolder, 'tiddlywiki.info'),
    );
    tiddlywiki(Object.values(tiddlers), tmpFolder, [
      ...['--output', distDir] /* 指定输出路径 */,
      ...[
        '--rendertiddler',
        '$:/plugins/tiddlywiki/tiddlyweb/save/offline',
        htmlName,
        'text/plain',
        '',
        'publishFilter',
        excludeFilter,
      ] /* 将wiki导出为HTML */,
    ]);
    // 由于导出是异步的，因此等待完成
    await waitForFile(path.join(distDir, htmlName));
  } catch (e) {
    console.error(e);
  }
  fs.rmSync(tmpFolder, { recursive: true, force: true });
};
