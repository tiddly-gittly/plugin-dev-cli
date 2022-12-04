# @tiddlywiki/plugin-dev

Tiddlywiki plugin development tool, working with [Modern.TiddlyDev](https://github.com/tiddly-gittly/Modern.TiddlyDev).

This is a npm CLI tool, helping developers to develop and build [TiddlyWiki](https://tiddlywiki.com) plugins with TypeScript (If you don't know TypeScript, you can also use it as a handy plug-in development tool.)

## Usage

This tool needs to be used with [Modern.TiddlyDev](https://github.com/tiddly-gittly/Modern.TiddlyDev), so it is not introduced here, please refer to [the Document of Modern.TiddlyDev](https://tiddly-gittly.github.io/Modern.TiddlyDev) for detailed usage.

### help

```bash
npx @tiddlywiki/plugin-dev help
```

output:

```
Usage: @tiddlywiki/plugin-dev [options] [command]

Options:
  -h, --help       display help for command

Commands:
  dev              Develop yout plugins with Modern.TiddlyDev
  build [options]  Build plugins for Modern.TiddlyDev
  help [command]   display help for command
```

### Developing plugins

Start a TiddlyWiki server with your plugin(s) for test. It will always watch the file changes in the plugin folder(s) and refresh the browser page automatically.

```bash
npx @tiddlywiki/plugin-dev dev
```

output:

```
Compiling...
████████████████████████████████████████ 100% | plugin-name

 syncer-server-filesystem: Dispatching 'save' task: $:/StoryList
Serving on http://127.0.0.1:8080
(press ctrl-C to exit)
```

### Build plugins

#### Build plugins alone

```bash
npx @tiddlywiki/plugin-dev build
```

output:

```
Compiling...
████████████████████████████████████████ 100% | plugin-name

 Minimized plugins
   2.02 KiB   $:/plugins/your-name/plugin-name
```

#### Build with a plugin library (publishing to your subscribers)

```bash
npx @tiddlywiki/plugin-dev build --library
```

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
