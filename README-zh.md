# tiddlywiki-plugin-dev

[![](https://img.shields.io/badge/加入-太微_中文社区-blue)](https://github.com/tiddly-gittly)

[English README](https://github.com/tiddly-gittly/plugin-dev-cli/blob/main/README.md)

Tiddlywiki 插件开发工具, 与 [Modern.TiddlyDev](https://github.com/tiddly-gittly/Modern.TiddlyDev) 共同工作。

这是一个 npm 命令行工具，帮助开发者使用 TypeScript 开发、发布 [TiddlyWiki](https://tiddlywiki.com) 插件（如果你不会 TypeScript，也没有关系，可以把它当做一个简单易用的插件开发工具）。

## 使用方法

该工具需要与 [Modern.TiddlyDev](https://github.com/tiddly-gittly/Modern.TiddlyDev) 一起使用，因此这里不过多介绍，详细使用方法请参考 [Modern.TiddlyDev 文档](https://tiddly-gittly.github.io/Modern.TiddlyDev)。

### 命令提示

```bash
npx tiddlywiki-plugin-dev help
```

输出：

```
Usage: tiddlywiki-plugin-dev [options] [command]

Options:
  -h, --help       display help for command

Commands:
  dev              Develop yout plugins with Modern.TiddlyDev
  build [options]  Build plugins for Modern.TiddlyDev
  help [command]   display help for command
```

### 插件开发

根据你所编写的插件，启动一个 TiddlyWiki 服务进行测试。期间将时刻关注插件文件夹中的变化并自动刷新页面。

```bash
npx tiddlywiki-plugin-dev dev
```

输出：

```
Compiling...
████████████████████████████████████████ 100% | plugin-name

 syncer-server-filesystem: Dispatching 'save' task: $:/StoryList
Serving on http://127.0.0.1:8080
(press ctrl-C to exit)
```

### 构建插件

#### 单独构建插件文件

```bash
npx tiddlywiki-plugin-dev build
```

输出：

```
Compiling...
████████████████████████████████████████ 100% | plugin-name

 Minimized plugins
   2.02 KiB   $:/plugins/your-name/plugin-name
```

#### 构建插件库（发布给你的订阅者）

```bash
npx tiddlywiki-plugin-dev build --library
```

输出：

```
Compiling...
████████████████████████████████████████ 100% | plugin-name

 Minimized plugins
   2.02 KiB   $:/plugins/your-name/plugin-name

Generating plugin library...
 syncer-server-filesystem: Dispatching 'save' task: $:/StoryList
 syncer-server-filesystem: Dispatching 'save' task: $:/UpgradeLibrary/List
 syncer-server-filesystem: Dispatching 'delete' task: $:/UpgradeLibrary
 syncer-server-filesystem: Dispatching 'delete' task: $:/UpgradeLibrary/List
```
