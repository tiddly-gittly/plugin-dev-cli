
# tiddlywiki-plugin-dev

## 0.4.1

### Patch Changes

- Moved `tiddlywiki` from `dependencies` to `peerDependencies` (`>=5.2.0`). This prevents a duplicate TiddlyWiki installation when the host project already has its own version (e.g. 5.4.0-prerelease). The host project must now provide `tiddlywiki` as a direct dependency; the CLI will use whichever version the host has installed.

## 0.4.0

### Major Changes

- Refactored dev/watch architecture: the dev process no longer crashes on TS/JS syntax errors, and will auto-recover after code is fixed.
- dev/watch now watches the wiki directory as well, including hot-reload for file and directory add/remove events.
- Decoupled CLI command definitions from implementation, with testable argument mapping.
- Added fixture-based tests for build/publish flows to ensure output artifacts are generated as expected.
- Introduced a testable abstraction for the dev refresh workflow, supporting error recovery and dependency injection.
- Upgraded dependencies and enforced Node.js >= 20 for compatibility.
- Improved unit test coverage: dev recovery, CLI argument mapping, build/publish output, and more.

## 0.2.0

### Minor Changes

- Allow listen on 0.0.0.0 via --lan on dev command

## 0.1.1

### Minor Changes

- Allow testing using `test` command, and write back to wiki using `dev --write-wiki`

## 0.0.39

### Patch Changes

- Update checksum algorithm, update project init strategy, fix package versio issue.

## 0.0.38

### Patch Changes

- Fixed an issue where files without .meta attachments on Windows OS were packaged into the plugin with the absolute path as title.

## 0.0.37

### Patch Changes

- Add Less, Sass, Stylus support

## 0.0.36

### Patch Changes

- fix bug that crash when packing project without tailwindcss config file

## 0.0.35

### Patch Changes

- Add support for tailwindcss

## 0.0.34

### Patch Changes

- no cache for online published index.html

## 0.0.33

### Patch Changes

- fix

## 0.0.32

### Patch Changes

- fix plugin exclude

## 0.0.31

### Patch Changes

- exclude plugin compiling

## 0.0.30

### Patch Changes

- can custom dev wiki path

## 0.0.29

### Patch Changes

- fix

## 0.0.28

### Patch Changes

- fix

## 0.0.27

### Patch Changes

- ignore when plugin folder does not have plugin.info

## 0.0.26

### Patch Changes

- can decide whether to monify some .css / .js

## 0.0.25

### Patch Changes

- packup now include all mjs, tsx, cjs, jsx, ts and js files

## 0.0.24

### Patch Changes

- fix new command

## 0.0.23

### Patch Changes

- fix bugs

## 0.0.22

### Patch Changes

- stable version

## 0.0.21

### Patch Changes

- fix

## 0.0.20

### Patch Changes

- add some magic

## 0.0.19

### Patch Changes

- add --wiki-path for publish

## 0.0.18

### Patch Changes

- fix

## 0.0.17

### Patch Changes

- output for init

## 0.0.16

### Patch Changes

- fix command

## 0.0.15

### Patch Changes

- fix chalk

## 0.0.14

### Patch Changes

- add init/new/publish

## 0.0.13

### Patch Changes

- fix import issue

## 0.0.12

### Patch Changes

- export build function

## 0.0.11

### Patch Changes

- fix issue that build may container another plugins' scripts

## 0.0.10

### Patch Changes

- fix path calculate issue on windows

## 0.0.9

### Patch Changes

- fix

## 0.0.8

### Patch Changes

- fix

## 0.0.7

### Patch Changes

- fix lock

## 0.0.6

### Patch Changes

- fix typo

## 0.0.5

### Patch Changes

- debounce the rebuild process

## 0.0.4

### Patch Changes

- fix

## 0.0.3

### Patch Changes

- Fix issue that old version plugin may override new plugin when old plugin tiddler is in wiki/tiddlers folder

## 0.0.2

### Patch Changes

- fix command

## 0.0.1

### Patch Changes

- First version
