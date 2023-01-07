import fs from 'fs';
import { dirname, resolve } from 'path';
import { ITiddlyWiki } from 'tw5-typed';
import { TiddlyWiki } from 'tiddlywiki';

/**
 * 初始化 TiddlyWiki
 *
 * @param {Record<string, unknown>[]} [preloadTiddlers=[]] 额外的 tiddler
 * @param {string} [dir='.'] 工作路径
 * @param {string[]} [commands=[]] 附加指令
 * @return {ITiddlyWiki}
 */
export const tiddlywiki = (
  preloadTiddlers: Record<string, unknown>[] = [],
  dir = '.',
  commands: string[] = [],
): ITiddlyWiki => {
  const $tw = TiddlyWiki();
  $tw.boot.argv = [dir, ...commands];
  $tw.preloadTiddlerArray(preloadTiddlers);
  $tw.boot.boot();
  return $tw;
};

/**
 * 确保某个文件对应的路径存在
 *
 * @param {string} fileName 文件路径
 */
export const mkdirsForFileSync = (fileName: string) => {
  const path = dirname(fileName);
  if (!fs.existsSync(path)) {
    mkdirsForFileSync(path);
    fs.mkdirSync(path);
  }
};

/**
 * 尝试深拷贝，from不存在不会出错，to存在也不会出错
 *
 * @param {string} from 源路径
 * @param {string} to 目标路径
 */
export const tryCopy = (from: string, to: string) => {
  if (fs.existsSync(from)) {
    fs.cpSync(from, to, { force: true, errorOnExist: false, recursive: true });
  }
};

/**
 * 递归遍历所有文件
 *
 * @param {string} dir 根路径
 * @param {(filepath: string, stats: fs.Stats) => void} callback 回调函数
 */
export const walkFilesSync = (
  dir: string,
  callback: (filepath: string, stats: fs.Stats) => void,
) => {
  const stats = fs.statSync(dir);
  if (stats.isFile()) {
    callback(dir, stats);
  } else {
    fs.readdirSync(dir).forEach(item =>
      walkFilesSync(resolve(dir, item), callback),
    );
  }
};

/**
 * 等待若干毫秒
 *
 * @async
 * @param {number} millionseconds 毫秒数
 * @return {Promise<void>}
 */
export const sleep = (millionseconds: number) =>
  new Promise<void>(resolve => setTimeout(() => resolve(), millionseconds));

/**
 * 等待直到某个文件存在
 *
 * @param {string} path 要检测的文件路径
 */
export const waitForFile = (path: string) =>
  new Promise<void>(resolve => {
    const id = setInterval(() => {
      resolve();
      if (fs.existsSync(path)) {
        resolve();
        clearInterval(id);
      }
    }, 100);
  });
