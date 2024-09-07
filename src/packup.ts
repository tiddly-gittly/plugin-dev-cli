/* eslint-disable max-lines */
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import sha256 from 'sha256';
import esbuild from 'esbuild';
import { uniq } from 'lodash';
import UglifyJS from 'uglify-js';
import CleanCSS from 'clean-css';
import cliProgress from 'cli-progress';
import browserslist from 'browserslist';
import type { ITiddlerFields, ITiddlyWiki } from 'tw5-typed';
import postCssPlugin from 'esbuild-style-plugin';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import esbuildSvelte from "esbuild-svelte";
import sveltePreprocess from "svelte-preprocess";
import { esbuildPluginBrowserslist } from 'esbuild-plugin-browserslist';
import { walkFilesSync } from './utils';

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
  'fsevents',
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
  compatibility: 'ie9',
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

export const rebuild = async (
  $tw: ITiddlyWiki,
  pluginsDir: string,
  updatePaths: string[] = [],
  devMode = true,
  excludeFilter?: string,
): Promise<ITiddlerFields[]> => {
  const baseDir = path.resolve(pluginsDir);
  if (!fs.existsSync(baseDir)) {
    return [];
  }

  // Touch TailwindCss config file
  const tailwindConfigPath = path.resolve('.', 'tailwind.config.js');
  if (!fs.existsSync(tailwindConfigPath)) {
    fs.writeFileSync(
      tailwindConfigPath,
      [
        'module.exports = {',
        "  content: ['./src/**/*.{mjs,cjs,js,ts,jsx,tsx}'],",
        '  theme: { extend: {} },',
        '  plugins: [],',
        '};',
      ].join('\n'),
      'utf-8',
    );
  }

  // eslint-disable-next-line no-console
  console.log(chalk.green.bold('Compiling...'));
  const bar = new cliProgress.SingleBar(
    {
      format: `${chalk.green('{bar}')} {percentage}% | {plugin}`,
      stopOnComplete: true,
    },
    cliProgress.Presets.shades_classic,
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
      if (!fs.existsSync(path.resolve(dir, 'plugin.info'))) {
        return undefined;
      }
      const plugin = $tw.loadPluginFolder(dir)!;

      // 过滤空插件
      if (!plugin?.title) {
        return undefined;
      }

      // 筛选插件
      if (
        excludeFilter &&
        $tw.wiki.filterTiddlers(`[[${plugin.title}]] +${excludeFilter}`)
          .length > 0
      ) {
        return undefined;
      }

      // 编译选项
      const browserslistStr =
        plugin['Modern.TiddlyDev#BrowsersList'] ??
        '>0.25%, not ie 11, not op_mini all';
      const externalModules = $tw.utils.parseStringArray(
        plugin['Modern.TiddlyDev#ExternalModules'] ?? '',
      );
      const nodeBuildInModulesToNotExternal = $tw.utils.parseStringArray(
        plugin['Modern.TiddlyDev#NodeModulesNotExternal'] ?? '',
      );
      const sourceMap =
        plugin['Modern.TiddlyDev#SourceMap']?.toLowerCase?.() === 'true';
      const minifyPlugin =
        plugin['Modern.TiddlyDev#Minify']?.toLowerCase?.() !== 'false';
      const tiddlers = JSON.parse(plugin.text).tiddlers as Record<
        string,
        ITiddlerFields
      >;

      // 删除之前可能存在于 Wiki 的同名插件，以免被旧的覆盖掉
      $tw.wiki.deleteTiddler(plugin.title);

      // 过滤没有 .meta 且不带原信息的文件，这些文件的 title 都是其绝对路径，*nix/bsd(macos)是/.*, win是\w:/
      Object.keys(tiddlers).forEach(title => {
        if (fs.existsSync(title) && !fs.existsSync(`${title}.meta`)) {
          delete tiddlers[title];
        }
      });

      // 检索编译入口
      const entryPoints: string[] = [];
      const metaMap = new Map<string, ITiddlerFields>();
      walkFilesSync(dir, filepath => {
        let meta = $tw.loadMetadataForFile(filepath);
        if (!meta) {
          return;
        }
        metaMap.set(filepath, meta);
        if (
          ['.ts', '.tsx', '.cjs', '.mjs', '.jsx'].includes(
            path.extname(filepath).toLowerCase(),
          )
        ) {
          if (meta['Modern.TiddlyDev#IncludeSource'] === 'true') {
            tiddlers[meta.title] = {
              ...meta,
              text: fs.readFileSync(filepath, 'utf-8'),
              'module-type': undefined,
            };
            if (meta['Modern.TiddlyDev#NoCompile'] !== 'true') {
              // 编译 + 保留源文件
              entryPoints.push(filepath);
              const titlePath = meta.title.split('/');
              const parts = titlePath[titlePath.length - 1].split('.');
              if (
                parts.length < 2 ||
                parts[parts.length - 1].toLowerCase() === 'js' ||
                !['ts', 'tsx', 'cjs', 'mjs', 'jsx'].includes(
                  parts[parts.length - 1].toLowerCase(),
                )
              ) {
                parts.push('js');
              } else {
                parts[parts.length - 1] = 'js';
              }
              titlePath[titlePath.length - 1] = parts.join('.');
              meta = {
                ...meta,
                title: titlePath.join('/'),
              };
            } else {
              // 不编译 + 保留原文件
              // do nothing
            }
          } else {
            delete tiddlers[meta.title];
            if (meta['Modern.TiddlyDev#NoCompile'] !== 'true') {
              // 编译 + 不保留原文件
              entryPoints.push(filepath);
              const titlePath = meta.title.split('/');
              const parts = titlePath[titlePath.length - 1].split('.');
              if (
                parts.length < 2 ||
                !['js', 'ts', 'tsx', 'cjs', 'mjs', 'jsx'].includes(
                  parts[parts.length - 1].toLowerCase(),
                )
              ) {
                parts.push('js');
              } else {
                parts[parts.length - 1] = 'js';
              }
              titlePath[titlePath.length - 1] = parts.join('.');
              meta = {
                ...meta,
                title: titlePath.join('/'),
              };
            } else {
              // 不编译 + 不保留原文件
              // do nothing
            }
          }
        }
        metaMap.set(filepath, meta);
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
        // incremental: true,
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
        external: [
          '$:/*',
          // allow whitelist some node build-in modules
          ...nodejsBuiltinModules.filter(
            name => !nodeBuildInModulesToNotExternal.includes(name),
          ),
          ...(externalModules ?? []),
        ],
        inject: [injectPath],
        // https://esbuild.github.io/api/#analyze
        metafile: true,
        banner: {
          js: '/* Compiled by Modern.TiddlyDev: https://github.com/tiddly-gittly/Modern.TiddlyDev */',
          css: '/* Compiled by Modern.TiddlyDev: https://github.com/tiddly-gittly/Modern.TiddlyDev */',
        },
        loader: {
          '.png': 'dataurl',
          '.woff': 'dataurl',
          '.woff2': 'dataurl',
          '.eot': 'dataurl',
          '.ttf': 'dataurl',
          '.svg': 'dataurl',
        },
        plugins: [
          // http://browserl.ist/?q=%3E0.25%25%2C+not+ie+11%2C+not+op_mini+all
          esbuildPluginBrowserslist(browserslist(browserslistStr), {
            printUnknownTargets: false,
          }),
          postCssPlugin({
            postcss: {
              plugins: [tailwindcss as any, autoprefixer as any],
            },
          }),
          esbuildSvelte({
            preprocess: sveltePreprocess(),
          }),
        ],
      });
      // 格式化并保存编译结果
      outputFiles.forEach(file => {
        // esbuild 的 matadata 路径无论是 windows 还是 POSIX 都是以 / 为分隔符，因此要额外处理
        const output =
          metafile.outputs[
            path.relative(rootPath, file.path).split(path.sep).join('/')
          ];
        let meta: ITiddlerFields = {} as any;
        if (output.entryPoint) {
          // 入口，一定是源代码文件
          const resolved = path.resolve(output.entryPoint);
          const relatived = path.relative(dir, output.entryPoint);
          if (metaMap.has(resolved)) {
            meta = {
              ...metaMap.get(resolved)!,
              type: 'application/javascript',
              'Modern.TiddlyDev#Origin': relatived,
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
              'Modern.TiddlyDev#Origin': relatived,
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
        Object.keys(tiddlers).forEach(title => {
          if (tiddlers[title]['Modern.TiddlyDev#Minify'] !== 'false') {
            tiddlers[title] = minifyTiddler(tiddlers[title]);
          }
        });
      }

      // 得到的字段要按字典序排序，保证哈希一致性
      const t = {
        ...plugin,
        text: JSON.stringify({ tiddlers }),
      };
      pluginCache[dir] = {} as unknown as ITiddlerFields;
      for (const key of Object.keys(t).sort()) {
        (pluginCache[dir] as any)[key] = (t as any)[key];
      }

      // 哈希校验
      if (!devMode) {
        (pluginCache[dir] as any)['Modern.TiddlyDev#SHA256-Hashed'] = sha256(
          JSON.stringify(pluginCache[dir]),
        );
      }

      bar.update(index + 1, { plugin: path.basename(dir) });
      return pluginCache[dir];
    }),
  );
  // eslint-disable-next-line no-console
  console.log('');

  return plugins.filter(plugin => plugin !== undefined) as ITiddlerFields[];
};
/* eslint-enable max-lines */
