import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

export const createPlugin = async () => {
  const { pluginType, pluginName, authorName, description } =
    await inquirer.prompt([
      {
        type: 'list',
        name: 'pluginType',
        message: 'What type of plugin to create?',
        choices: ['plugin', 'theme', 'language'],
        default: 'plugin',
      },
      {
        type: 'input',
        name: 'pluginName',
        message: "What's the plugin's name",
      },
      { type: 'input', name: 'authorName', message: "What's your name" },
      {
        type: 'input',
        name: 'description',
        message: "What's your description of this plugin",
      },
    ]);
  // eslint-disable-next-line no-console
  console.log(chalk.green.bold('Creating...'));
  if (!fs.existsSync(path.resolve('src'))) {
    fs.mkdirSync(path.resolve('src'));
  }
  const pluginPath = path.resolve('src', encodeURIComponent(pluginName));
  if (fs.existsSync(pluginPath)) {
    const { override } = await inquirer.prompt({
      type: 'confirm',
      name: 'override',
      message: `${pluginPath} already exists, override?`,
      default: false,
    });
    if (!override) {
      return;
    }
  } else {
    fs.mkdirSync(pluginPath);
  }
  const pluginTitle = `$:/${pluginType}/${authorName}/${pluginName}`;
  fs.writeFileSync(
    path.resolve(pluginPath, 'plugin.info'),
    JSON.stringify(
      {
        title: pluginTitle,
        name: pluginName,
        author: authorName,
        description,
        'plugin-type': pluginType,
        version: '0.0.1',
        list: 'readme',
      },
      undefined,
      2,
    ),
  );
  fs.writeFileSync(
    path.resolve(pluginPath, 'readme.tid'),
    [
      `title: ${pluginTitle}/readme`,
      'type: text/vnd.tiddlywiki',
      '',
      `! ${pluginName}`,
      '',
      description,
    ].join('\n'),
  );
  // eslint-disable-next-line no-console
  console.log(
    chalk.green.bold(
      `Created plugin ${pluginTitle} at src/${encodeURIComponent(pluginName)}`,
    ),
  );
};
