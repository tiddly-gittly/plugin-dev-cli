import path from 'path';
import { execSync, execFileSync } from 'child_process';

const rootDir = path.resolve(__dirname, '..');
const nodeCommand = process.execPath;
const cliEntry = path.join(rootDir, 'dist', 'js', 'main.js');

const runNode = (args: string[]) =>
  execFileSync(nodeCommand, args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: process.env,
  });

const runBin = (args: string[]) => {
  const quotedArgs = args.map(arg => `"${arg}"`).join(' ');
  return execSync(`pnpm exec tiddlywiki-plugin-dev ${quotedArgs}`, {
    cwd: rootDir,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
  });
};

describe('built cli smoke', () => {
  beforeAll(() => {
    execSync('pnpm build', {
      cwd: rootDir,
      encoding: 'utf8',
      env: process.env,
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    });
  }, 180000);

  test('main cli help works from built artifact', () => {
    const output = runNode([cliEntry, '--help']);

    expect(output).toContain('Usage:');
    expect(output).toContain('dev');
    expect(output).toContain('build');
  });

  test('dev subcommand help works from built artifact', () => {
    const output = runNode([cliEntry, 'dev', '--help']);

    expect(output).toContain('Usage:');
    expect(output).toContain('--wiki');
    expect(output).toContain('--src');
  });

  test('dev subcommand help works via package bin shim', () => {
    const output = runBin(['dev', '--help']);

    expect(output).toContain('Usage:');
    expect(output).toContain('--wiki');
    expect(output).toContain('--src');
  });
});
