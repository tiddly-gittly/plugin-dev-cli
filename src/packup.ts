import fs from 'fs';
import path from 'path';
import sha256 from 'sha256';
import esbuild from 'esbuild';
import { uniq } from 'lodash';
import UglifyJS from 'uglify-js';
import CleanCSS from 'clean-css';
import colors from 'ansi-colors';
import cliProgress from 'cli-progress';
import browserslist from 'browserslist';
import { ITiddlerFields, ITiddlyWiki } from 'tw5-typed';
import { esbuildPluginBrowserslist } from 'esbuild-plugin-browserslist';

const nodejsBuiltinModules = [
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'https',
  'net',
  'os',
  'path',
  'punycode',
  'querystring',
  'readline',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'zlib',
];

const injectPath = path.resolve(__dirname, 'esbuild-inject.js');
const rootPath = process.cwd();

// 插件构建缓存
const pluginCache: Record<string, ITiddlerFields> = {};

const UglifyJSOption = {
  warnings: false,
  v8: true,
  ie: true,
  webkit: true,
};

const cleanCSS = new CleanCSS({
  compatibility: 'ie8',
  level: 2,
});

const minifyTiddler = (tiddler: ITiddlerFields) => {
  const { text, type } = tiddler;
  try {
    if (type === 'application/javascript') {
      const minified = UglifyJS.minify(text, UglifyJSOption).code;
      if (minified !== undefined) {
        return {
          ...tiddler,
          text: minified,
        };
      }
    } else if (type === 'text/css') {
      const minified = cleanCSS.minify(text).styles;
      if (minified !== undefined) {
        return {
          ...tiddler,
          text: minified,
        };
      }
    }
  } catch (e) {
    console.error(e);
    console.error(`Failed to minify ${tiddler.title}.`);
  }
  return tiddler;
};

const walkFilesSync = (
  dir: string,
  callback: (filepath: string, stats: fs.Stats) => void,
) => {
  const stats = fs.statSync(dir);
  if (stats.isFile()) {
    callback(dir, stats);
  } else {
    fs.readdirSync(dir).forEach(item =>
      walkFilesSync(path.resolve(dir, item), callback),
    );
  }
};

export const rebuild = async (
  $tw: ITiddlyWiki,
  pluginsDir: string,
  updatePaths: string[] = [],
  devMode = true,
): Promise<ITiddlerFields[]> => {
  const baseDir = path.resolve(pluginsDir);
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  // eslint-disable-next-line no-console
  console.log(colors.green.bold('Compiling...'));
  const bar = new cliProgress.SingleBar(
    {
      format: `${colors.green('{bar}')} {percentage}% | {plugin}`,
      stopOnComplete: true,
    },
    cliProgress.Presets.shades_classic,
  );
  const tmp = ($tw.boot as any).excludeRegExp.toString();
  const filterExp = new RegExp(
    `/^.*\\.tsx?$|^.*\\.cjs?$|^.*\\.mjs?$|^.*\\.jsx?$|${tmp.substring(
      1,
      tmp.length - 1,
    )}/`,
  );
  const updateDirs = uniq(
    updatePaths
      .filter(file => file)
      .map(file => path.resolve(path.dirname(file))),
  );
  const pluginDirs = fs
    .readdirSync(baseDir)
    .map(dirname => path.resolve(baseDir, dirname))
    .filter(dir => fs.statSync(dir).isDirectory());
  bar.start(pluginDirs.length, 0);
  const plugins = await Promise.all(
    pluginDirs.map(async (dir, index) => {
      bar.update(index, { plugin: path.basename(dir) });
      // 检查插件是否被修改过，缓存
      const update =
        !pluginCache.hasOwnProperty(dir) ||
        updateDirs.length === 0 ||
        updateDirs.some(updateDir => updateDir.startsWith(dir));
      if (!update) {
        bar.update(index + 1, { plugin: path.basename(dir) });
        return pluginCache[dir];
      }

      // 读取非编译内容
      const plugin: ITiddlerFields = ($tw as any).loadPluginFolder(
        dir,
        filterExp,
      );

      // 编译选项
      const browserslistStr = (plugin['Modern.TiddlyDev::BrowsersList'] ??
        '>0.25%, not ie 11, not op_mini all') as string;
      const externalModules = $tw.utils.parseStringArray(
        (plugin['Modern.TiddlyDev::ExternalModules'] as string) ?? '',
      );
      const sourceMap = plugin['Modern.TiddlyDev::SourceMap'] === true;
      const minifyPlugin = plugin['Modern.TiddlyDev::Minify'] !== false;
      const tiddlers = JSON.parse(plugin.text).tiddlers as Record<
        string,
        ITiddlerFields
      >;

      // 删除之前可能存在于 Wiki 的同名插件，以免被旧的覆盖掉
      ($tw.wiki as any).deleteTiddler(plugin.title);

      // 过滤没有 .meta 且不带原信息的文件，这些文件的 title 都是绝对路径
      Object.keys(tiddlers).forEach(title => {
        if (title.startsWith('/') && fs.existsSync(title)) {
          delete tiddlers[title];
        }
      });

      // 检索编译入口
      const entryPoints: string[] = [];
      const metaMap = new Map<string, ITiddlerFields>();
      walkFilesSync(baseDir, filepath => {
        const meta = ($tw as any).loadMetadataForFile(
          filepath,
        ) as ITiddlerFields | null;
        if (!meta) {
          return;
        }
        metaMap.set(filepath, meta);
        if (
          ['.ts', '.tsx', '.cjs', '.mjs', '.jsx'].includes(
            path.extname(filepath).toLowerCase(),
          )
        ) {
          if (meta['Modern.TiddlyDev::NoCompile'] !== 'true') {
            entryPoints.push(filepath);
          }
          if (meta['Modern.TiddlyDev::IncludeSource'] === 'true') {
            entryPoints.push(filepath);
            tiddlers[meta.title] = {
              ...meta,
              text: fs.readFileSync(filepath, 'utf-8'),
            };
          }
        }
      });
      // 编译
      const { outputFiles, metafile } = await esbuild.build({
        entryPoints,
        bundle: true,
        // 为什么不用 ESbuild 的压缩：UglifyJS 的压缩效率更好
        // 参考：https://github.com/privatenumber/minification-benchmarks
        minify: false,
        write: false,
        allowOverwrite: true,
        incremental: true,
        outdir: baseDir,
        outbase: baseDir,
        sourcemap: devMode || sourceMap ? 'inline' : false,
        // https://esbuild.github.io/api/#format
        format: 'cjs',
        // https://esbuild.github.io/api/#tree-shaking
        treeShaking: true,
        // https://esbuild.github.io/api/#platform
        platform: 'browser',
        // https://esbuild.github.io/api/#external
        external: ['$:/*', ...nodejsBuiltinModules, ...externalModules],
        inject: [injectPath],
        // https://esbuild.github.io/api/#analyze
        metafile: true,
        banner: {
          js: '/* Compiled by Modern.TiddlyDev: https://github.com/tiddly-gittly/Modern.TiddlyDev */',
          css: '/* Compiled by Modern.TiddlyDev: https://github.com/tiddly-gittly/Modern.TiddlyDev */',
        },
        plugins: [
          // http://browserl.ist/?q=%3E0.25%25%2C+not+ie+11%2C+not+op_mini+all
          esbuildPluginBrowserslist(browserslist(browserslistStr), {
            printUnknownTargets: false,
          }),
        ],
      });
      // 格式化并保存编译结果
      outputFiles.forEach(file => {
        const output = metafile!.outputs[path.relative(rootPath, file.path)];
        let meta: ITiddlerFields = {} as any;
        if (output.entryPoint) {
          // 入口，一定是源代码文件
          const resolved = path.resolve(output.entryPoint);
          const relatived = path.relative(dir, output.entryPoint);
          if (metaMap.has(resolved)) {
            meta = {
              ...metaMap.get(resolved)!,
              type: 'application/javascript',
              'Modern.TiddlyDev::Origin': relatived,
            };
          } else {
            // 应该不存在这种情况
            return;
          }
        } else {
          // 不是入口却被导出了，说明是资源文件
          const name = Object.keys(output.inputs)[0];
          if (name) {
            const resolved = path.resolve(name);
            const relatived = path.relative(dir, name);
            const type =
              $tw.config.fileExtensionInfo[
                path.extname(file.path).toLowerCase()
              ]?.type ?? '';
            meta = {
              title: '',
              tags: type === 'text/css' ? ['$:/tags/Stylesheet'] : [],
              ...(metaMap.get(resolved) ?? {}),
              type,
              'Modern.TiddlyDev::Origin': relatived,
            } as ITiddlerFields;
          }
          if (!meta.title) {
            const parsed = path.parse(path.relative(dir, file.path));
            const tmp = path.join(plugin.title, parsed.dir, parsed.name);
            if (tiddlers.hasOwnProperty(`${tmp}${parsed.ext}`)) {
              let id = 1;
              while (tiddlers.hasOwnProperty(`${tmp}${id}${parsed.ext}`)) {
                id++;
              }
              (meta as any).title = tiddlers.hasOwnProperty(
                `${tmp}${id}${parsed.ext}`,
              );
            } else {
              (meta as any).title = `${tmp}${parsed.ext}`;
            }
          }
        }
        tiddlers[meta.title] = {
          ...meta,
          text: file.text,
        };
      });

      // 最小化
      if (!devMode && minifyPlugin) {
        Object.keys(tiddlers).forEach(
          title => (tiddlers[title] = minifyTiddler(tiddlers[title])),
        );
      }

      pluginCache[dir] = {
        ...plugin,
        text: JSON.stringify({ tiddlers }),
      };

      // 哈希校验
      if (!devMode) {
        (pluginCache[dir] as any)['Modern.TiddlyDev::SHA256-Hashed'] = sha256(
          JSON.stringify(pluginCache[dir]),
        );
      }

      bar.update(index + 1, { plugin: path.basename(dir) });
      return pluginCache[dir];
    }),
  );
  // eslint-disable-next-line no-console
  console.log('');

  return plugins;
};
