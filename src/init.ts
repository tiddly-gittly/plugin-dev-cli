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
  execSync(`npx dprint config update`, { cwd: path.resolve(project), stdio: 'inherit' });
};
