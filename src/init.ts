import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import simpleGitt from 'simple-git';

export const init = async (
  project: string,
  githubUrl: string,
  npmUrl?: string,
) => {
  if (fs.existsSync(project)) {
    console.error(`${project} already exists!`);
    return;
  }
  const { npm, authorName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'npm',
      message: 'Which package manager do you use?',
      choices: ['npm', 'yarn', 'pnpm', 'tnpm', 'cnpm'],
      default: 'npm',
    },
    {
      type: 'input',
      name: 'authorName',
      message: "What's your name ($:/plugins/<fill in your name>/plugin-name)",
    },
  ]);
  const { pluginName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'pluginName',
      message: `What's the plugin's name ($:/plugins/${authorName}/<fill in plugin name>)`,
    },
  ]);
  // eslint-disable-next-line no-console
  console.log(chalk.green.bold(`Cloning template project from ${githubUrl}`));
  // pull template
  await simpleGitt().clone(githubUrl, project, ['-b', 'template']);
  const git = simpleGitt({
    baseDir: path.resolve(project),
  });
  // 修改 git 信息
  await git.removeRemote('origin');
  await git.branch(['-m', 'template', 'master']);
  const shallowPath = path.resolve(project, '.git', 'shallow');
  if (fs.existsSync(shallowPath)) {
    fs.rmSync(path.resolve(project, '.git', 'shallow'));
  }
  // npm 镜像
  if (npmUrl) {
    fs.writeFileSync(
      path.resolve(project, '.npmrc'),
      [
        ...fs
          .readFileSync(path.resolve(project, '.npmrc'), 'utf-8')
          .split('\n'),
        `registry=${npmUrl}`,
      ]
        .map(line => line.trim())
        .filter(line => line !== '')
        .join('\n'),
    );
  }
  // 安装
  execSync(`${npm} install`, { cwd: path.resolve(project), stdio: 'inherit' });
  // 更新 npm 依赖
  execSync(`${npm} run update`, {
    cwd: path.resolve(project),
    stdio: 'inherit',
  });
  // 安装
  execSync(`${npm} install`, { cwd: path.resolve(project), stdio: 'inherit' });
  // CI 脚本修改
  const ciPath = path.resolve(project, '.github', 'workflows');
  if (fs.existsSync(ciPath)) {
    for (const file of fs.readdirSync(ciPath)) {
      if (path.extname(file) !== '.yml') {
        continue;
      }
      const filePath = path.resolve(ciPath, file);
      const content = fs
        .readFileSync(filePath, 'utf-8')
        .replace(
          /npm\s+install\s+-g\s+pnpm\s+&&\s+/g,
          npm === 'npm' ? '' : `npm install -g ${npm} && `,
        )
        .replace(/pnpm\s+install/g, `${npm} install`)
        .replace(/pnpm\s+run/g, `${npm} run`);
      fs.writeFileSync(filePath, content, 'utf-8');
    }
  }
  // 更新 dprint 依赖
  execSync(`npx dprint config update`, {
    cwd: path.resolve(project),
    stdio: 'inherit',
  });
  // 更新模板里的占位符插件名
  const nameFrom = '$:/plugins/your-name/plugin-name';
  const nameTo = `$:/plugins/${authorName}/${pluginName}`;
  const pluginPathFrom = path.resolve(project, 'src', 'plugin-name');
  const pluginPathTo = path.resolve(project, 'src', pluginName);
  replaceStringInFilesSync(pluginPathFrom, nameFrom, nameTo);
  fs.renameSync(pluginPathFrom, pluginPathTo);
  replaceStringInFilesSync(path.resolve(project, 'wiki'), nameFrom, nameTo);
};

/**
 * Synchronously replaces all occurrences of a specified string in all files of a folder, including subdirectories.
 *
 * @param {string} dir - The directory to search in.
 * @param {string} searchString - The string to search for.
 * @param {string} replaceString - The string to replace with.
 */
function replaceStringInFilesSync(
  dir: string,
  searchString: string,
  replaceString: string,
): void {
  const files: string[] = fs.readdirSync(dir);

  files.forEach((file: string) => {
    const filePath: string = path.join(dir, file);
    const stats: fs.Stats = fs.statSync(filePath);

    if (stats.isFile()) {
      const data: string = fs.readFileSync(filePath, 'utf8');
      const result: string = data.replaceAll(searchString, replaceString);
      fs.writeFileSync(filePath, result, 'utf8');
    } else if (stats.isDirectory()) {
      // Recurse into the subdirectory
      replaceStringInFilesSync(filePath, searchString, replaceString);
    }
  });
}
