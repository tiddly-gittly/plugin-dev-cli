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
  const { npm } = await inquirer.prompt([
    {
      type: 'list',
      name: 'npm',
      message: 'Which package manager do you use?',
      choices: ['npm', 'yarn', 'pnpm', 'tnpm', 'cnpm'],
      default: 'npm',
    },
  ]);
  // eslint-disable-next-line no-console
  console.log(chalk.green.bold(`Cloning template project from ${githubUrl}`));
  // pull template
  await simpleGitt().clone(githubUrl, project, ['--depth=1', '-b', 'template']);
  await simpleGitt({
    baseDir: path.resolve(project),
  }).removeRemote('origin');
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
  execSync(`${npm} install`, { cwd: path.resolve(project), stdio: 'inherit' });
  execSync(`${npm} run update`, {
    cwd: path.resolve(project),
    stdio: 'inherit',
  });
  execSync(`${npm} install`, { cwd: path.resolve(project), stdio: 'inherit' });
};
